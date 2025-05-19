/**
 * OpenAI Text-to-Speech API 라우트
 * 텍스트를 음성으로 변환하여 오디오 바이너리 데이터를 반환
 */
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Edge Runtime 설정
export const runtime = 'edge';

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST 요청 처리 - 텍스트를 음성으로 변환
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json(
        { error: '변환할 텍스트가 필요합니다.' },
        { status: 400 }
      );
    }

    // OpenAI TTS API 호출
    const audioResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: text,
    });

    // 오디오 데이터를 ArrayBuffer로 변환
    const audioBuffer = await audioResponse.arrayBuffer();

    // 바이너리 데이터를 Base64로 인코딩
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({ audio: base64Audio });
  } catch (error: Error | unknown) {
    console.error('TTS API 오류:', error);
    
    const errorMessage = error instanceof Error ? error.message : '음성 변환에 실패했습니다.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 