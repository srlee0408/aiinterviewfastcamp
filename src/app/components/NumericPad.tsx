'use client';

import { useState } from 'react';

interface NumericPadProps {
  onComplete: (phoneNumber: string) => void;
}

/**
 * 갤럭시 스타일의 전화번호 입력 키패드 컴포넌트
 * 010-XXXX-XXXX 형식의 전화번호를 입력받고 패턴 검증 후 완료 시 콜백 호출
 */
export default function NumericPad({ onComplete }: NumericPadProps) {
  // 입력된 전화번호 상태 관리
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  // 제출 중 상태 관리
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  /**
   * 숫자 버튼 클릭 처리 함수
   * 전화번호 형식에 맞게 입력값 처리
   */
  const handleNumberClick = (num: string) => {
    // 최대 13자리(하이픈 포함) 제한
    if (phoneNumber.length >= 13) return;

    let newPhoneNumber = phoneNumber;

    // 첫 입력 시 010- 자동 입력
    if (phoneNumber === '' && num !== '0') {
      newPhoneNumber = '010-' + num;
    } else if (phoneNumber === '') {
      newPhoneNumber = '0';
    } else if (phoneNumber === '0') {
      newPhoneNumber = '01';
    } else if (phoneNumber === '01') {
      newPhoneNumber = '010-';
    } else if (phoneNumber === '010-' && num !== '0') {
      newPhoneNumber = phoneNumber + num;
    } else if (phoneNumber.length === 8) { // 010-XXXX 다음에 하이픈 추가
      newPhoneNumber = phoneNumber + '-' + num;
    } else {
      newPhoneNumber = phoneNumber + num;
    }

    setPhoneNumber(newPhoneNumber);
  };

  /**
   * 삭제 버튼 클릭 처리 함수
   * 한 글자씩 삭제하되 하이픈은 함께 처리
   */
  const handleDelete = () => {
    if (phoneNumber.length === 0) return;

    // 하이픈이 있는 경우 함께 삭제
    if (phoneNumber.endsWith('-')) {
      setPhoneNumber(phoneNumber.slice(0, -1));
    }
    
    setPhoneNumber(phoneNumber.slice(0, -1));
  };

  /**
   * 전화번호 유효성 검사 함수
   * 010-XXXX-XXXX 형식 확인
   */
  const isValidPhoneNumber = (phone: string) => {
    const regex = /^010-\d{4}-\d{4}$/;
    return regex.test(phone);
  };

  /**
   * 완료(확인) 버튼 클릭 처리 함수
   * 유효성 검사 후 모달 표시 및 콜백 호출
   */
  const handleConfirm = () => {
    if (isValidPhoneNumber(phoneNumber) && !isSubmitting) {
      setIsSubmitting(true);
      // 즉시 콜백 호출하여 로딩 상태 및 API 호출 시작
      onComplete(phoneNumber);
    }
  };

  /**
   * 전화번호 표시 형식 변환 함수
   * 입력되지 않은 부분을 X로 표시
   */
  const displayPhoneNumber = () => {
    if (!phoneNumber) {
      return '여기에 번호가 표시됩니다';
    }

    // 기본 패턴: 010-XXXX-XXXX
    if (phoneNumber.length <= 4) { // 010- 이하
      return phoneNumber.padEnd(4, 'X') + '-XXXX-XXXX';
    } else if (phoneNumber.length <= 9) { // 010-XXXX 이하
      // 하이픈 제외하고 앞 3자리 이후 추출
      const digits = phoneNumber.replace(/-/g, '').slice(3);
      return `010-${digits.padEnd(4, 'X')}-XXXX`;
    } else { // 010-XXXX-XXXX 형식
      // 하이픈 제외하고 앞 7자리 이후 추출
      const digits = phoneNumber.replace(/-/g, '').slice(7);
      return `010-${phoneNumber.replace(/-/g, '').slice(3, 7)}-${digits.padEnd(4, 'X')}`;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6 text-black">AI 면접 프로그램</h1>
      <p className="text-center mb-2 text-black">전화번호를 입력해주세요.</p>
      <p className="text-center mb-8 text-black">입력 후 확인 버튼을 눌러주세요.</p>
      
      {/* 입력된 전화번호 표시 영역 */}
      <div className="w-full bg-[#F5F5F5] p-6 rounded-lg mb-6 text-center border border-gray-200">
        <p className="text-xl font-medium text-black">
          {displayPhoneNumber()}
        </p>
      </div>
      
      {/* 숫자 키패드 */}
      <div className="grid grid-cols-3 gap-2 w-full">
        {/* 1-9 숫자 버튼 */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            className="bg-[#4285F4] text-white py-5 rounded-lg text-2xl font-medium hover:opacity-90 active:opacity-80 transition-opacity"
            onClick={() => handleNumberClick(num.toString())}
            disabled={isSubmitting}
          >
            {num}
          </button>
        ))}
        
        {/* *, 0, # 버튼 */}
        <button 
          className="bg-[#4285F4] text-white py-5 rounded-lg text-2xl font-medium hover:opacity-90 active:opacity-80 transition-opacity"
          onClick={() => handleNumberClick('*')}
          disabled={isSubmitting}
        >
          *
        </button>
        <button 
          className="bg-[#4285F4] text-white py-5 rounded-lg text-2xl font-medium hover:opacity-90 active:opacity-80 transition-opacity"
          onClick={() => handleNumberClick('0')}
          disabled={isSubmitting}
        >
          0
        </button>
        <button 
          className="bg-[#4285F4] text-white py-5 rounded-lg text-2xl font-medium hover:opacity-90 active:opacity-80 transition-opacity"
          onClick={() => handleNumberClick('#')}
          disabled={isSubmitting}
        >
          #
        </button>
      </div>
      
      {/* 버튼 컨테이너 */}
      <div className="w-full grid grid-cols-1 gap-4 mt-4">
        {/* 삭제 버튼 */}
        <button
          className="w-full bg-red-500 text-white py-4 rounded-lg text-lg font-medium hover:opacity-90 active:opacity-80 transition-opacity flex items-center justify-center"
          onClick={handleDelete}
          disabled={isSubmitting}
        >
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
              d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z"
            />
          </svg>
          지우기
        </button>
        
        {/* 확인 버튼 또는 로딩 상태 */}
        {isSubmitting ? (
          <div className="w-full py-4 rounded-lg bg-gray-200 text-center">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600 mr-2"></div>
              <span className="text-gray-600">처리 중...</span>
            </div>
          </div>
        ) : (
          <button
            className={`w-full py-4 rounded-lg text-xl font-medium transition-opacity ${
              isValidPhoneNumber(phoneNumber)
                ? 'bg-[#E9ECEF] text-black hover:opacity-90 active:opacity-80'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            onClick={handleConfirm}
            disabled={!isValidPhoneNumber(phoneNumber)}
          >
            확인
          </button>
        )}
      </div>
    </div>
  );
} 