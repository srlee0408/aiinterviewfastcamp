import { NextRequest, NextResponse } from 'next/server';

// Edge Runtime 설정
export const runtime = 'edge';

/**
 * OpenAI Whisper API에 대한 프록시 라우트
 * 클라이언트에서 직접 API 키를 노출하지 않고 서버를 통해 요청을 중계
 */
export async function POST(request: NextRequest) {
  try {
    // 환경 변수에서 API 키 가져오기
    const apiKey = process.env.OPENAI_API_KEY;
    
    // API 키가 없으면 오류 응답
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }
    
    // 요청 본문 가져오기
    const formData = await request.formData();
    
    // 요청 헤더
    const headers = {
      Authorization: `Bearer ${apiKey}`,
    };
    
    // OpenAI Whisper API 호출
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers,
      body: formData,
    });
    
    // API 응답 추출
    const data = await response.json();
    
    // 성공하면 텍스트 반환
    if (response.ok) {
      return NextResponse.json(data);
    } else {
      // 오류 응답
      return NextResponse.json(
        { error: data.error?.message || '음성 변환에 실패했습니다.' },
        { status: response.status }
      );
    }
  } catch (error: Error | unknown) {
    console.error('Whisper API 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '서버 오류가 발생했습니다.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 