import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * AI 면접 진행 화면 컴포넌트
 * AI가 자동으로 질문 생성 후 TTS로 재생, 사용자는 녹음 버튼을 통해 답변
 */
interface InterviewProps {
  onComplete: () => void;
}

// QA 인터페이스 정의
interface QA {
  q: string;
  aText: string;
  durationSec: number;
}

const Interview: React.FC<InterviewProps> = ({ onComplete }) => {
  // 답변 로그 배열 (형식 변경)
  const [qaLogs, setQaLogs] = useState<Array<QA>>([]);
  
  // 녹음 상태 (0: 대기, 1: 녹음 중)
  const [recordingState, setRecordingState] = useState<number>(0);
  
  // AI 상태 (0: 대기, 1: 질문 중, 2: 질문 완료)
  const [aiState, setAiState] = useState<number>(0);

  // 로딩 상태 (Whisper API 처리 중)
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // 오류 메시지
  const [errorMessage, setErrorMessage] = useState<string>("");
  
  // 스레드 ID (Assistant API)
  const [threadId, setThreadId] = useState<string>("");
  
  // 초기화 완료 상태
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  // 녹음 시작 시간
  const recordStartTimeRef = useRef<number>(0);
  
  // 오디오 관련 ref
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // 초기화 플래그 ref (렌더링에 영향 없이 상태 관리)
  const isInitializingRef = useRef<boolean>(false);
  
  // 오디오 리소스 정리 함수
  const cleanupAudio = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
  };
  
  // Base64를 Blob으로 변환하는 유틸리티 함수
  const base64ToBlob = useCallback((base64: string, mimeType: string) => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Blob([bytes], { type: mimeType });
  }, []);
  
  // TTS 재생 함수
  const playTTS = useCallback(async (text: string) => {
    try {
      // AI 질문 중 상태 유지
      setAiState(1);
      
      // 기존 오디오 요소 초기화
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        if (audioRef.current.srcObject) {
          URL.revokeObjectURL(audioRef.current.src);
        }
      } else {
        audioRef.current = new Audio();
      }
      
      // 오디오 재생 완료 이벤트 - 여기서 상태 변경
      audioRef.current.onended = () => {
        // 재생 완료 시 URL 객체 해제
        if (audioRef.current?.src) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        // 질문 완료 상태로 변경 (사용자 답변 대기)
        setAiState(2);
      };

      // TTS API 호출
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.audio) {
        // Base64 오디오 데이터를 Blob으로 변환
        const audioBlob = base64ToBlob(data.audio, 'audio/mpeg');
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // 오디오 요소에 소스 설정 및 재생
        audioRef.current.src = audioUrl;
        
        try {
          // 오디오 재생 시도 (자동 재생 정책으로 실패할 수 있음)
          await audioRef.current.play();
          // 성공적으로 재생 시작 - aiState는 1 유지 (질문 중)
        } catch (playError) {
          console.warn('오디오 자동 재생 실패:', playError);
          // 자동 재생 실패 시 질문 완료 상태로 즉시 전환
          setAiState(2);
        }
      } else {
        console.error('TTS 오류:', data.error);
        // TTS 실패 시 바로 질문 완료 상태로 넘어감
        setAiState(2);
      }
    } catch (error) {
      console.error('TTS API 오류:', error);
      // 오류 발생 시 바로 질문 완료 상태로 넘어감
      setAiState(2);
    }
  }, [base64ToBlob, setAiState]);
  
  // GPT로 다음 질문 생성 및 TTS로 재생하는 함수 - useCallback으로 감싸서 의존성 문제 해결
  const startNextQuestion = useCallback(async (currentThreadId: string, userMessage: string) => {
    // 이미 질문 중이면 무시
    if (aiState === 1) {
      return;
    }
    
    // AI 질문 중 상태로 변경
    setAiState(1);
    
    try {
      // GPT Assistant API로 다음 질문 생성
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendMessage',
          threadId: currentThreadId,
          message: userMessage
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.message) {
        const nextQuestion = data.message;
        
        // QA 로그에 새 질문 추가
        setQaLogs(prevLogs => [...prevLogs, {
          q: nextQuestion,
          aText: '',
          durationSec: 0
        }]);
        
        // TTS로 질문 음성 생성 및 재생
        await playTTS(nextQuestion);
        
        // 질문 완료 상태로 변경은 playTTS 함수 내에서 오디오 재생 완료 후 처리
      } else {
        console.error('질문 생성 오류:', data.error);
        setErrorMessage('질문을 생성할 수 없습니다. 다시 시도해주세요.');
        setAiState(0);
      }
    } catch (error) {
      console.error('질문 생성 API 오류:', error);
      setErrorMessage('서버 연결에 문제가 발생했습니다. 다시 시도해주세요.');
      setAiState(0);
    }
  }, [aiState, playTTS, setQaLogs, setErrorMessage]);
  
  // 컴포넌트가 마운트되면 스레드 생성 및 첫 질문 시작
  useEffect(() => {
    // 이미 초기화 중이거나 완료된 경우 실행하지 않음
    if (isInitializingRef.current || isInitialized) {
      return;
    }
    
    const initInterview = async () => {
      // 초기화 중 플래그 설정
      isInitializingRef.current = true;
      
      try {
        // Assistant API Thread 생성
        const threadResponse = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'createThread' }),
        });
        
        const threadData = await threadResponse.json();
        
        if (threadResponse.ok && threadData.threadId) {
          setThreadId(threadData.threadId);
          // 첫 질문 시작
          await startNextQuestion(threadData.threadId, "면접을 시작합니다. 첫번째 질문을 해주세요.");
          // 초기화 완료 상태 설정
          setIsInitialized(true);
        } else {
          setErrorMessage('면접 초기화에 실패했습니다. 새로고침 후 다시 시도해주세요.');
        }
      } catch (error) {
        console.error('초기화 오류:', error);
        setErrorMessage('면접 초기화 중 오류가 발생했습니다. 새로고침 후 다시 시도해주세요.');
      } finally {
        // 초기화 작업 완료
        isInitializingRef.current = false;
      }
    };
    
    initInterview();
    
    // 컴포넌트 언마운트 시 리소스 정리
    return () => {
      stopRecording();
      cleanupAudio();
    };
  }, [isInitialized, startNextQuestion]); // isInitialized와 startNextQuestion을 의존성 배열에 추가
  
  // 실시간 오디오 파형 그리기 함수
  const drawWaveform = () => {
    if (!analyserRef.current || !dataArrayRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 캔버스 크기 설정
    const width = canvas.width;
    const height = canvas.height;
    
    // 캔버스 초기화
    ctx.clearRect(0, 0, width, height);
    
    // 파형 색상 설정
    ctx.fillStyle = '#3B82F6'; // blue-500
    
    // 오디오 데이터 가져오기
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    
    // 파형 그리기
    const barWidth = width / dataArrayRef.current.length * 2.5;
    let x = 0;
    
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      // 주파수 데이터를 높이로 변환
      const barHeight = (dataArrayRef.current[i] / 255) * height * 0.8;
      
      // 바 그리기
      ctx.fillRect(x, height / 2 - barHeight / 2, barWidth - 1, barHeight);
      x += barWidth;
    }
    
    // 다음 프레임 요청
    animationFrameRef.current = requestAnimationFrame(drawWaveform);
  };
  
  // 녹음 초기화 및 시작 함수
  const initializeRecording = async () => {
    try {
      // 기존 스트림 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // 오디오 스트림 요청
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // MediaRecorder 설정
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      // 오디오 청크 수집
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };
      
      // 녹음 완료 시 처리
      mediaRecorder.onstop = async () => {
        await processAudioToText();
      };
      
      // Web Audio API 설정
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      // 오디오 소스 및 분석기 설정
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      
      // 분석기 설정
      analyser.fftSize = 128;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;
      
      // 연결
      source.connect(analyser);
      
      // 녹음 시작 시간 기록
      recordStartTimeRef.current = Date.now();
      
      // 녹음 시작
      mediaRecorder.start();
      
      // 파형 그리기 시작
      drawWaveform();
      
    } catch (error) {
      console.error('마이크 액세스 오류:', error);
      setErrorMessage('마이크에 접근할 수 없습니다. 마이크 권한을 확인해주세요.');
      setRecordingState(0);
    }
  };
  
  // 녹음 중지 함수
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };
  
  // 오디오를 텍스트로 변환하는 함수
  const processAudioToText = async () => {
    if (audioChunksRef.current.length === 0) {
      console.warn('오디오 데이터가 없습니다.');
      return;
    }
    
    // 이미 처리 중이면 중복 실행 방지
    if (isProcessing) {
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // 녹음 종료 시간 및 지속 시간 계산
      const recordEndTime = Date.now();
      const recordDuration = (recordEndTime - recordStartTimeRef.current) / 1000; // 초 단위
      
      // 오디오 Blob 생성
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // FormData 생성
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'ko');
      
      // Whisper API 요청
      const response = await fetch('/api/whisper', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (response.ok && data.text) {
        // QA 로그 업데이트 (함수형 업데이트로 최신 상태 보장)
        setQaLogs(prevLogs => {
          const updatedLogs = [...prevLogs];
          if (updatedLogs.length > 0) {
            const lastQA = updatedLogs[updatedLogs.length - 1];
            lastQA.aText = data.text;
            lastQA.durationSec = recordDuration;
          }
          return updatedLogs;
        });
        
        // 다음 질문 시작 (지연 시간 추가)
        setTimeout(async () => {
          // 현재 스레드 ID 캡처하여 클로저 문제 방지
          const currentThreadId = threadId;
          if (currentThreadId) {
            await startNextQuestion(currentThreadId, data.text);
          } else {
            setErrorMessage('면접 세션이 유효하지 않습니다. 새로고침 후 다시 시도해주세요.');
          }
        }, 1000);
      } else {
        console.error('음성 인식 오류:', data.error);
        setErrorMessage('음성 인식에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('API 요청 오류:', error);
      setErrorMessage('서버 연결에 문제가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // 녹음 시작/중지 함수
  const toggleRecording = () => {
    // AI가 질문 중일 때는 녹음 불가
    if (aiState === 1 || isProcessing) return;
    
    // 현재 상태 토글
    const newRecordingState = recordingState === 0 ? 1 : 0;
    setRecordingState(newRecordingState);
    
    if (newRecordingState === 1) {
      // 녹음 시작
      initializeRecording();
    } else {
      // 녹음 종료
      stopRecording();
    }
  };
  
  // 면접 종료 핸들러
  const handleEndInterview = async () => {
    // 진행 중인 모든 활동 중지
    stopRecording();
    cleanupAudio();
    
    // 오디오 재생 중지
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    // 상태 초기화
    setAiState(0);
    setRecordingState(0);
    setIsProcessing(false);
    
    // qaLogs에서 면접 내용을 텍스트로 변환
    let interviewContent = "";
    
    // qaLogs가 비어있는 경우 처리
    if (qaLogs.length === 0) {
      interviewContent = "면접 기록이 없습니다";
    } else {
      // 모든 질문과 답변을 포함 (답변이 없는 경우도 포함)
      qaLogs.forEach((qa, index) => {
        // 빈 답변도 포함
        const answer = qa.aText || "";
        interviewContent += `질문 : ${qa.q}, 답변 : ${answer}`;
        
        // 마지막 항목이 아니면 구분자 추가
        if (index < qaLogs.length - 1) {
          interviewContent += ", ";
        }
      });
    }
    
    try {
      // 로컬 스토리지에서 사용자 전화번호 가져오기
      const cachedData = localStorage.getItem('aiInterviewCache');
      let contactNumber = "";
      
      if (cachedData) {
        try {
          const parsedData = JSON.parse(cachedData);
          const rawPhoneNumber = parsedData.contact || "";
          
          // 전화번호 형식 변환 (하이픈 추가)
          if (rawPhoneNumber) {
            // 숫자만 추출
            const digits = rawPhoneNumber.replace(/\D/g, '');
            
            // 전화번호 형식에 맞게 하이픈 추가
            if (digits.length === 11) {
              // 11자리 (대부분의 휴대폰 번호)
              contactNumber = `${digits.substr(0, 3)}-${digits.substr(3, 4)}-${digits.substr(7)}`;
            } else if (digits.length === 10) {
              // 10자리 (일부 지역번호 또는 휴대폰 번호)
              contactNumber = `${digits.substr(0, 3)}-${digits.substr(3, 3)}-${digits.substr(6)}`;
            } else {
              // 다른 형식은 그대로 사용
              contactNumber = rawPhoneNumber;
            }
          }
        } catch (error) {
          console.error('로컬 스토리지 데이터 파싱 오류:', error);
        }
      }
      
      // 웹훅으로 면접 데이터 전송 (전화번호 포함)
      const response = await fetch('https://hook.eu2.make.com/k2or8j48zsxurw4s1twmibogh6uu99hf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewlog: interviewContent,
          contact: contactNumber
        })
      });
      
      if (!response.ok) {
        console.error('웹훅 전송 실패:', response.status, response.statusText);
      } else {
        console.log('면접 로그가 성공적으로 전송되었습니다.');
      }
    } catch (error) {
      console.error('웹훅 전송 중 오류 발생:', error);
    } finally {
      // 웹훅 성공 여부와 관계없이 면접 완료 처리
      onComplete();
    }
  };
  
  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto">
      {/* 헤더 */}
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-xl font-bold">AI 면접</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            aiState === 1 ? 'bg-blue-500 animate-pulse' : 
            recordingState === 1 ? 'bg-red-500 animate-pulse' : 'bg-gray-300'
          }`}></div>
          <svg 
            className={`w-6 h-6 ${
              aiState === 1 ? 'text-blue-500' :
              recordingState === 1 ? 'text-red-500' : 'text-gray-500'
            }`} 
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
        </div>
      </div>
      
      {/* 상태 표시 */}
      <div className="flex flex-col items-center p-4">
        <div className={`text-sm font-medium px-3 py-1 rounded-full ${
          aiState === 1 ? 'bg-blue-100 text-blue-800' : 
          recordingState === 1 ? 'bg-red-100 text-red-800' : 
          isProcessing ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {isProcessing ? '음성 변환 중...' :
           aiState === 1 ? 'AI 음성 재생 중...' : 
           recordingState === 1 ? '답변 녹음 중...' : 
           aiState === 2 ? '답변해 주세요' : '대기 중'}
        </div>
      </div>
      
      {/* 실시간 오디오 파형 */}
      <div className="bg-white border rounded-lg mx-4 h-24 flex items-center justify-center relative overflow-hidden">
        {/* 실제 Canvas 파형 (녹음 중일 때만 사용) */}
        {recordingState === 1 && (
          <canvas 
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            width={300}
            height={96}
          />
        )}
        
        {/* 정적 파형 또는 안내 메시지 */}
        {recordingState === 0 && (
          <div className="h-16 w-full px-4 flex items-center justify-center">
            {isProcessing ? (
              /* 처리 중일 때 로딩 애니메이션 */
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <p className="text-gray-500 text-sm">음성을 텍스트로 변환 중...</p>
              </div>
            ) : (
              /* 대기 중일 때 보여줄 메시지 */
              <p className="text-gray-400 text-center text-sm">
                {aiState === 1 
                  ? "AI가 질문하고 있습니다... 질문이 끝나면 답변해 주세요." 
                  : aiState === 2 
                    ? "녹음 버튼을 클릭하여 답변을 시작하세요"
                    : "면접을 진행하고 있습니다..."}
              </p>
            )}
          </div>
        )}
      </div>
      
      {/* 에러 메시지 */}
      {errorMessage && (
        <div className="mx-4 mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-xs text-center">
          {errorMessage}
        </div>
      )}
      
      {/* 녹음 컨트롤 */}
      <div className="flex flex-col items-center my-4">
        <button
          onClick={toggleRecording}
          disabled={aiState === 1 || isProcessing}
          className={`w-16 h-16 rounded-full flex items-center justify-center focus:outline-none shadow-lg 
            ${
              // AI 질문 중이거나 처리 중일 때는 항상 회색, 비활성화
              (aiState === 1 || isProcessing)
                ? 'bg-gray-300 text-white cursor-not-allowed opacity-50'
                : recordingState === 0
                  // 대기 상태일 때는 파란색
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  // 녹음 중일 때는 빨간색
                  : 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
            }`}
          aria-label={recordingState === 0 ? "녹음 시작" : "녹음 종료"}
        >
          {aiState === 1 ? (
            /* AI 말하는 중 아이콘 */
            <svg 
              className="w-8 h-8" 
              fill="currentColor" 
              viewBox="0 0 20 20" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
            </svg>
          ) : recordingState === 0 ? (
            /* 녹음 시작 아이콘 */
            <svg 
              className="w-8 h-8" 
              fill="currentColor" 
              viewBox="0 0 20 20" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
            </svg>
          ) : (
            /* 녹음 중지 아이콘 */
            <svg 
              className="w-8 h-8" 
              fill="currentColor" 
              viewBox="0 0 20 20" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>
      
      {/* 답변 로그 섹션 */}
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {qaLogs.length > 0 && qaLogs.some(qa => qa.aText) && (
          <h3 className="text-sm font-semibold text-gray-600 mb-2">질문 & 답변 기록</h3>
        )}
        {qaLogs.map((qa, index) => (
          qa.aText && (
            <div key={index} className="mb-6">
              <div className="bg-blue-50 p-2 rounded-t-lg border border-blue-200">
                <p className="text-xs text-blue-800 font-medium">질문</p>
                <p className="text-sm text-blue-900">{qa.q}</p>
              </div>
              <div className="bg-gray-50 p-2 rounded-b-lg border-x border-b border-gray-200">
                <p className="text-xs text-gray-600 font-medium">
                  답변
                </p>
                <p className="text-sm text-gray-800">{qa.aText}</p>
              </div>
            </div>
          )
        ))}
      </div>
      
      {/* 면접 종료 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-center">
        <button
          onClick={handleEndInterview}
          className="bg-red-100 text-red-700 font-medium py-2 px-6 rounded-lg hover:bg-red-200 focus:outline-none"
        >
          면접 종료
        </button>
      </div>
    </div>
  );
};

export default Interview; 