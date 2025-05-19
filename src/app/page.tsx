'use client';

import { useState } from 'react';
import NumericPad from './components/NumericPad';
import MicTest from './components/MicTest';
import PreCheck from './components/PreCheck';
import Interview from './components/Interview';

/**
 * AI 면접 프로그램의 메인 페이지 컴포넌트
 * 전화번호 입력 단계에서 시작하여 다음 단계로 진행
 */
export default function Home() {
  // 현재 단계 상태 관리 (0: 전화번호 입력, 1: 마이크 테스트, 2: 준비 체크리스트, 3: 면접 진행)
  const [currentStep, setCurrentStep] = useState<number>(0);
  // 성공 모달 표시 상태
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  // 로딩 상태
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * 전화번호 입력 완료 시 호출되는 콜백 함수
   * 다음 단계로 진행하기 위한 상태 업데이트 및 웹훅 전송
   */
  const handlePhoneNumberComplete = async (number: string) => {
    setIsLoading(true);
    
    // 웹훅으로 전화번호만 전송
    try {
      const response = await fetch('https://hook.eu2.make.com/nzkj68he0l6s1sulkmqoyxlr1g6j8itg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contact: number, // 전화번호만 전송
        }),
      });
      
      // 응답 데이터 받기
      const responseData = await response.json().catch(() => null);
      
      if (response.ok) {
        console.log('웹훅 전송 성공:', number, responseData);
        
        // 로컬 스토리지에 임시 저장 (전화번호만 저장)
        localStorage.setItem('aiInterviewCache', JSON.stringify({
          contact: number
        }));
        
        // Make에서 성공 응답을 받은 경우 등록 완료 상태 설정
        if (responseData && responseData.success === true) {
          // 성공 모달 표시
          setShowSuccessModal(true);
          
          // 3초 후 모달 닫기 및 다음 단계로 진행
          setTimeout(() => {
            setShowSuccessModal(false);
            setCurrentStep(1);
          }, 3000);
        } else {
          // 응답이 성공이지만 success 플래그가 없는 경우
          setShowSuccessModal(true);
          setTimeout(() => {
            setShowSuccessModal(false);
            setCurrentStep(1);
          }, 3000);
        }
      } else {
        console.error('웹훅 전송 실패:', response.statusText, responseData);
        setIsLoading(false);
        setCurrentStep(1);
      }
    } catch (error) {
      console.error('웹훅 전송 중 오류 발생:', error);
      setIsLoading(false);
      setCurrentStep(1);
    }
  };

  /**
   * 마이크 테스트 완료 시 호출되는 콜백 함수
   * 다음 단계(준비 체크리스트)로 진행
   */
  const handleMicTestComplete = () => {
    setCurrentStep(2);
  };

  /**
   * 준비 체크리스트 완료 시 호출되는 콜백 함수
   * 다음 단계(면접 진행)로 진행
   */
  const handlePreCheckComplete = () => {
    setCurrentStep(3);
  };

  /**
   * 면접 완료 시 호출되는 콜백 함수
   * 면접 완료 상태로 다음 단계로 진행
   */
  const handleInterviewComplete = () => {
    setCurrentStep(4);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white text-black">
      <div className="w-full max-w-md mx-auto">
        {/* 전화번호 입력 단계 */}
        {currentStep === 0 && (
          <NumericPad onComplete={handlePhoneNumberComplete} />
        )}
        
        {/* 마이크 테스트 단계 */}
        {currentStep === 1 && (
          <MicTest onComplete={handleMicTestComplete} />
        )}
        
        {/* 준비 체크리스트 단계 */}
        {currentStep === 2 && (
          <PreCheck onComplete={handlePreCheckComplete} />
        )}
        
        {/* 면접 진행 단계 */}
        {currentStep === 3 && (
          <Interview onComplete={handleInterviewComplete} />
        )}
        
        {/* 면접 완료 단계 */}
        {currentStep === 4 && (
          <div className="text-center">
            <h2 className="text-xl font-bold mb-4 text-black">면접 완료</h2>
            <p className="text-black">면접이 성공적으로 완료되었습니다.</p>
            <p className="text-black mt-4">결과가 처리되어 전송되었습니다.</p>
          </div>
        )}
        
        {/* 로딩 인디케이터 */}
        {isLoading && currentStep === 0 && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-40">
            <div className="bg-white p-6 rounded-lg flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-700">처리 중입니다...</p>
            </div>
          </div>
        )}
        
        {/* 등록 완료 성공 모달 */}
        {showSuccessModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
            <div className="bg-white p-8 rounded-lg shadow-lg text-center w-[280px] max-w-[80%]">
              <svg 
                className="w-16 h-16 text-green-500 mx-auto mb-4" 
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
              <h3 className="text-xl font-bold text-green-600 mb-2">등록 완료</h3>
              <p className="text-black">전화번호 등록이 완료되었습니다.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
