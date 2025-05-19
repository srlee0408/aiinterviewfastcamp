'use client';

import { useState, useRef, useEffect } from 'react';

interface MicTestProps {
  onComplete: () => void;
}

/**
 * 음성 테스트 컴포넌트
 * 마이크 권한 요청, 5초 녹음, Whisper 변환 테스트 수행
 */
export default function MicTest({ onComplete }: MicTestProps) {
  // 녹음 상태 관리
  const [isRecording, setIsRecording] = useState<boolean>(false);
  // 녹음 완료 상태
  const [isRecordingComplete, setIsRecordingComplete] = useState<boolean>(false);
  // 변환 중 상태
  const [isConverting, setIsConverting] = useState<boolean>(false);
  // 변환 결과 상태
  const [conversionResult, setConversionResult] = useState<string>('');
  // 변환 성공 여부
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  // 오류 메시지
  const [errorMessage, setErrorMessage] = useState<string>('');
  // 로딩 상태
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // 마이크 권한 상태
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  // 자동 종료 타이머가 완료되었는지 여부
  const [isTimerComplete, setIsTimerComplete] = useState<boolean>(false);
  
  // 녹음기 참조
  const recorderRef = useRef<MediaRecorder | null>(null);
  // 오디오 데이터 조각 참조
  const audioChunksRef = useRef<Blob[]>([]);
  // 오디오 시각화를 위한 캔버스 참조
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // 오디오 컨텍스트 참조
  const audioContextRef = useRef<AudioContext | null>(null);
  // 애니메이션 프레임 참조
  const animationFrameRef = useRef<number | null>(null);
  // 분석기 노드 참조
  const analyserRef = useRef<AnalyserNode | null>(null);
  // 스트림 참조
  const streamRef = useRef<MediaStream | null>(null);
  
  // 녹음 시작 타임스탬프
  const recordStartTimeRef = useRef<number>(0);
  // 녹음 타이머 참조
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // 남은 시간
  const [remainingTime, setRemainingTime] = useState<number>(5);

  /**
   * 마이크 권한 요청 및 녹음 시작 함수
   */
  const startRecording = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      setIsTimerComplete(false);
      
      // 기존 스트림 중지
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // 브라우저 지원 확인
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        throw new Error('브라우저가 미디어 녹음 기능을 지원하지 않습니다.');
      }
      
      // 마이크 권한 요청
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicPermission('granted');
      
      // 오디오 시각화 설정
      setupAudioVisualization(stream);
      
      // 미디어 녹음기 생성
      const mediaRecorder = new MediaRecorder(stream);
      recorderRef.current = mediaRecorder;
      
      // 녹음 데이터 수집
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // 녹음 완료 시 처리
      mediaRecorder.onstop = handleRecordingComplete;
      
      // 녹음 시작
      mediaRecorder.start();
      setIsRecording(true);
      setIsLoading(false);
      recordStartTimeRef.current = Date.now();
      
      // 5초 타이머 설정
      setRemainingTime(5);
      timerRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            // 타이머가 완료되면 자동 종료되지 않고 사용자가 버튼을 눌러야 함을 표시
            setIsTimerComplete(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (error: Error | unknown) {
      console.error('녹음 시작 오류:', error);
      setIsLoading(false);
      const errorMessage = error instanceof Error ? error.message : '마이크 접근에 실패했습니다.';
      setErrorMessage(errorMessage);
      
      if (error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')) {
        setMicPermission('denied');
      }
    }
  };

  /**
   * 오디오 시각화 설정 함수
   */
  const setupAudioVisualization = (stream: MediaStream) => {
    // 기존 오디오 컨텍스트 정리
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (error) {
        console.error('AudioContext 닫기 오류:', error);
      }
    }
    
    // 오디오 컨텍스트 생성
    const audioContext = new (window.AudioContext || (window as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext)();
    audioContextRef.current = audioContext;
    
    // 소스 노드 생성
    const source = audioContext.createMediaStreamSource(stream);
    
    // 분석기 노드 생성
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;
    
    // 소스를 분석기에 연결
    source.connect(analyser);
    
    // 캔버스 애니메이션 시작
    startCanvasAnimation();
  };

  /**
   * 캔버스 애니메이션 시작 함수
   */
  const startCanvasAnimation = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // 캔버스 크기 설정
    canvas.width = canvas.clientWidth * 2;
    canvas.height = canvas.clientHeight * 2;
    
    const draw = () => {
      // 애니메이션 프레임 요청
      animationFrameRef.current = requestAnimationFrame(draw);
      
      // 주파수 데이터 얻기
      analyser.getByteTimeDomainData(dataArray);  // 시간 도메인 데이터 사용 (웨이브폼)
      
      // 캔버스 초기화
      canvasCtx.fillStyle = '#f5f5f5';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      
      // 웨이브폼 그리기
      canvasCtx.lineWidth = 3;
      canvasCtx.strokeStyle = '#4285F4';
      canvasCtx.beginPath();
      
      const sliceWidth = canvas.width / (bufferLength - 1);
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;
        
        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    };
    
    // 애니메이션 시작
    draw();
  };

  /**
   * 녹음 중지 함수
   */
  const stopRecording = () => {
    // 타이머 중지
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // 녹음 중지
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop();
      setIsRecording(false);
      recorderRef.current = null;
    }
    
    // 애니메이션 프레임 취소
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // 컨텍스트는 여기에서 닫지 않음 - 녹음 완료 후 Whisper 변환이 필요하기 때문
    // 트랙도 여기에서 중지하지 않음 - 오디오 데이터가 필요하기 때문
  };

  /**
   * 녹음 완료 처리 함수
   */
  const handleRecordingComplete = async () => {
    setIsRecordingComplete(true);
    setIsConverting(true);
    
    try {
      // 녹음된 데이터로 오디오 Blob 생성
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      
      // Whisper API로 음성을 텍스트로 변환
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.wav');
      formData.append('model', 'whisper-1');
      formData.append('language', 'ko');
      
      // OpenAI Whisper API 호출 (프록시 서버를 통해 호출)
      const response = await fetch('/api/whisper', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('음성 변환에 실패했습니다.');
      }
      
      const result = await response.json();
      setConversionResult(result.text || '');
      
      // 텍스트가 비어있지 않으면 성공
      if (result.text && result.text.trim() !== '') {
        setIsSuccess(true);
      } else {
        setIsSuccess(false);
      }
    } catch (error: Error | unknown) {
      console.error('음성 변환 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '음성 변환 중 오류가 발생했습니다.';
      setErrorMessage(errorMessage);
      setIsSuccess(false);
    } finally {
      setIsConverting(false);
    }
  };

  /**
   * 재시도 함수
   */
  const handleRetry = () => {
    // 상태 초기화
    setIsRecordingComplete(false);
    setConversionResult('');
    setIsSuccess(null);
    setErrorMessage('');
    setIsTimerComplete(false);
    
    // 스트림이 있으면 트랙 중지
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // 새로운 녹음 시작
    startRecording();
  };

  /**
   * 다음 단계로 진행 함수
   */
  const handleNext = () => {
    // 스트림이 있으면 트랙 중지
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // 컴포넌트 종료 시 뒷정리
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (error) {
        console.error('AudioContext 닫기 오류:', error);
      }
      audioContextRef.current = null;
    }
    
    // 완료 콜백 호출
    onComplete();
  };

  // 컴포넌트 마운트 시 클린업 함수
  useEffect(() => {
    return () => {
      // 타이머 정리
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // 애니메이션 프레임 정리
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // 오디오 컨텍스트 정리
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch (error) {
          console.error('AudioContext 닫기 오류:', error);
        }
        audioContextRef.current = null;
      }
      
      // 스트림 트랙 중지
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6 text-black">마이크 테스트</h1>
      {micPermission === 'denied' ? (
        <div className="text-center mb-8">
          <p className="text-red-500 mb-4">마이크 접근 권한이 거부되었습니다.</p>
          <p className="text-gray-600 mb-2">브라우저 설정에서 마이크 권한을 허용한 후 다시 시도해주세요.</p>
          <button
            className="mt-4 bg-[#4285F4] text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-600"
            onClick={handleRetry}
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
          <p className="text-center mb-2 text-black">
            {!isRecordingComplete
              ? "마이크 테스트를 위해 아래 버튼을 클릭해주세요."
              : isSuccess === true
              ? "마이크 테스트가 성공했습니다."
              : isSuccess === false
              ? "마이크 테스트에 실패했습니다. 다시 시도해주세요."
              : "음성을 변환하는 중입니다..."}
          </p>
          <p className="text-center mb-4 text-gray-500 text-sm">
            {!isRecordingComplete && !isRecording
              ? "녹음이 시작되면 5초 동안 간단한 말을 해주세요. (예: '안녕하세요, 테스트입니다')"
              : isRecording && !isTimerComplete
              ? "5초 후에 자동으로 녹음이 종료됩니다. 또는 아래 버튼을 눌러 직접 종료할 수 있습니다."
              : isRecording && isTimerComplete
              ? "아래 '녹음 종료' 버튼을 눌러 녹음을 완료해주세요."
              : ""}
          </p>

          {/* 오디오 시각화 캔버스 */}
          <div className="w-full bg-[#F5F5F5] p-4 rounded-xl shadow mb-6 h-36 relative overflow-hidden">
            {isRecording ? (
              <>
                <canvas
                  ref={canvasRef}
                  className="w-full h-full absolute inset-0"
                />
                <div className="absolute top-2 right-2 px-2 py-1 bg-black bg-opacity-50 rounded-full text-white text-xs">
                  녹음 중
                </div>
              </>
            ) : isRecordingComplete ? (
              <div className="w-full h-full flex items-center justify-center">
                {!isConverting && isSuccess === true && (
                  <div className="text-center">
                    <svg
                      className="w-10 h-10 mx-auto mb-2 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <p className="text-sm text-gray-700">변환 성공</p>
                  </div>
                )}
                {!isConverting && isSuccess === false && (
                  <div className="text-center">
                    <svg
                      className="w-10 h-10 mx-auto mb-2 text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    <p className="text-sm text-gray-700">변환 실패</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 h-full flex flex-col items-center justify-center">
                <svg
                  className="w-12 h-12 mx-auto mb-2 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
                <p>녹음을 시작하려면 버튼을 클릭하세요</p>
              </div>
            )}
            
            {/* 변환 결과 표시 */}
            {isRecordingComplete && !isConverting && conversionResult && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white bg-opacity-90 p-4 rounded-lg max-w-xs">
                  <p className="text-center font-medium">
                    {isSuccess === true ? (
                      <span className="text-green-600">✓ 변환 성공:</span>
                    ) : (
                      <span className="text-red-500">✗ 변환 실패</span>
                    )}
                  </p>
                  <p className="text-sm mt-2 text-gray-700">&quot;{conversionResult}&quot;</p>
                </div>
              </div>
            )}
            
            {/* 변환 중 로딩 표시 */}
            {isConverting && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white bg-opacity-90 p-4 rounded-lg">
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
                    <p>음성을 변환하는 중...</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 남은 시간 표시 */}
          {isRecording && (
            <div className="mb-4">
              <p className="text-xl font-medium text-center">
                {isTimerComplete 
                  ? "녹음 완료! 아래 버튼을 눌러 종료하세요" 
                  : `${remainingTime}초 남음`}
              </p>
              {!isTimerComplete && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-1000" 
                    style={{ width: `${(remainingTime / 5) * 100}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}

          {/* 오류 메시지 */}
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-lg text-red-700">
              <p>{errorMessage}</p>
            </div>
          )}

          {/* 버튼 영역 */}
          <div className="w-full grid grid-cols-1 gap-4">
            {!isRecordingComplete ? (
              <button
                className={`w-full py-4 rounded-lg text-xl font-medium transition-opacity ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-[#4285F4] text-white hover:opacity-90'
                }`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    <span>준비 중...</span>
                  </div>
                ) : isRecording ? (
                  <>
                    <span className="flex items-center justify-center">
                      <svg 
                        className="w-5 h-5 mr-2" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24" 
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth="2" 
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth="2" 
                          d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                        />
                      </svg>
                      녹음 종료
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center justify-center">
                      <svg 
                        className="w-5 h-5 mr-2" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24" 
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth="2" 
                          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                        />
                      </svg>
                      녹음 시작
                    </span>
                  </>
                )}
              </button>
            ) : (
              <>
                {/* 재시도 버튼 */}
                <button
                  className="w-full bg-gray-200 text-black py-4 rounded-lg text-lg font-medium hover:bg-gray-300 transition-colors"
                  onClick={handleRetry}
                >
                  다시 시도
                </button>
                
                {/* 성공 시에만 다음 버튼 활성화 */}
                <button
                  className={`w-full py-4 rounded-lg text-xl font-medium transition-opacity ${
                    isSuccess
                      ? 'bg-[#4285F4] text-white hover:opacity-90'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  onClick={handleNext}
                  disabled={!isSuccess}
                >
                  다음
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
} 