'use client';

import { useState } from 'react';

interface PreCheckProps {
  onComplete: () => void;
}

/**
 * 면접 준비 체크리스트 컴포넌트
 * 면접 시작 전 필요한 4가지 항목을 확인하고 체크하도록 안내
 */
export default function PreCheck({ onComplete }: PreCheckProps) {
  // 체크된 항목 상태 관리
  const [checkedItems, setCheckedItems] = useState<{ [key: string]: boolean }>({
    noise: false,
    microphone: false,
    internet: false,
    mindset: false
  });

  /**
   * 모든 항목이 체크되었는지 확인하는 함수
   */
  const allChecked = (): boolean => {
    return Object.values(checkedItems).every(value => value === true);
  };

  /**
   * 체크박스 상태 변경 처리 함수
   */
  const handleCheck = (key: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  /**
   * 다음 단계 버튼 클릭 시 호출되는 함수
   */
  const handleNext = () => {
    if (allChecked()) {
      onComplete();
    }
  };

  // 체크 항목 정의
  const checkItems = [
    {
      id: 'noise',
      title: '주변 소음 확인',
      description: '조용한 환경에서 면접이 진행되고 있는지 확인해주세요.'
    },
    {
      id: 'microphone',
      title: '마이크 상태',
      description: '마이크가 올바르게 작동하고 있는지 확인해주세요.'
    },
    {
      id: 'internet',
      title: '인터넷 상태',
      description: '안정적인 인터넷 연결 상태인지 확인해주세요.'
    },
    {
      id: 'mindset',
      title: '마음가짐 확인',
      description: '면접을 위한 준비가 되었는지 마음가짐을 확인해주세요.'
    }
  ];

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6 text-black">면접 준비 체크리스트</h1>
      <p className="text-center mb-8 text-black">모든 항목을 확인하고 체크해주세요.</p>
      
      {/* 체크리스트 */}
      <div className="w-full space-y-3">
        {checkItems.map((item) => (
          <div 
            key={item.id}
            className="flex items-start p-4 bg-[#F5F5F5] rounded-xl shadow"
          >
            <div className="flex items-center h-6 mt-0.5">
              <input
                type="checkbox"
                id={item.id}
                checked={checkedItems[item.id]}
                onChange={() => handleCheck(item.id)}
                className="h-5 w-5 rounded border-gray-300 text-[#4285F4] focus:ring-[#4285F4] cursor-pointer"
              />
            </div>
            <label 
              htmlFor={item.id} 
              className="ml-3 flex-1 cursor-pointer"
            >
              <span className="block text-lg font-medium text-gray-900">
                {item.title}
              </span>
              <p className="text-sm text-gray-600">{item.description}</p>
            </label>
          </div>
        ))}
      </div>
      
      {/* 다음 버튼 */}
      <button
        className={`w-full py-4 mt-8 rounded-lg text-xl font-medium transition-opacity ${
          allChecked()
            ? 'bg-[#4285F4] text-white hover:opacity-90 active:opacity-80'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
        onClick={handleNext}
        disabled={!allChecked()}
      >
        다음
      </button>
    </div>
  );
} 