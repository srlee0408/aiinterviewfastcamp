/**
 * OpenAI Assistants API를 사용하는 면접관 API 라우트
 * 클라이언트에서 thread 생성, 메시지 전송, 응답 조회를 처리
 */
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Edge Runtime 설정
export const runtime = 'edge';

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 면접관 Assistant ID (사용자 지정 값)
const ASSISTANT_ID = 'asst_h2mLBVQJ6O0CE9EOaaV2eClk';

/**
 * POST 요청 처리 - 스레드 생성 또는 메시지 전송
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, threadId, message } = body;

    // 액션에 따라 다른 처리
    switch (action) {
      case 'createThread':
        return handleCreateThread();
      case 'sendMessage':
        return handleSendMessage(threadId, message);
      default:
        return NextResponse.json(
          { error: '유효하지 않은 액션입니다.' },
          { status: 400 }
        );
    }
  } catch (error: Error | unknown) {
    console.error('Assistant API 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '서버 오류가 발생했습니다.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * 새 스레드 생성 처리
 */
async function handleCreateThread() {
  const thread = await openai.beta.threads.create();
  return NextResponse.json({ threadId: thread.id });
}

/**
 * 메시지 전송 및 응답 처리
 */
async function handleSendMessage(threadId: string, message: string) {
  if (!threadId) {
    return NextResponse.json(
      { error: '스레드 ID가 필요합니다.' },
      { status: 400 }
    );
  }

  if (!message) {
    return NextResponse.json(
      { error: '메시지 내용이 필요합니다.' },
      { status: 400 }
    );
  }

  try {
    // 사용자 메시지 추가
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message,
    });

    // 실행 생성 및 완료 대기
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
    });

    // 실행 완료 대기
    const runStatus = await waitForRunCompletion(threadId, run.id);

    // 응답 메시지 가져오기
    const messages = await openai.beta.threads.messages.list(threadId);
    const assistantMessages = messages.data.filter(
      (msg) => msg.role === 'assistant'
    );

    // 가장 최근 응답 반환
    if (assistantMessages.length > 0) {
      const latestMessage = assistantMessages[0];
      const content = latestMessage.content[0];
      
      if (content.type === 'text') {
        return NextResponse.json({
          message: content.text.value,
          runStatus: runStatus.status,
        });
      }
    }

    return NextResponse.json({
      message: '응답을 생성할 수 없습니다.',
      runStatus: runStatus.status,
    });
  } catch (error: Error | unknown) {
    const errorMessage = error instanceof Error ? error.message : '메시지 처리 중 오류가 발생했습니다.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * 실행 완료 대기 함수
 */
async function waitForRunCompletion(threadId: string, runId: string, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const run = await openai.beta.threads.runs.retrieve(threadId, runId);
    
    if (run.status === 'completed') {
      return run;
    }
    
    if (['failed', 'cancelled', 'expired'].includes(run.status)) {
      throw new Error(`실행이 ${run.status} 상태로 종료되었습니다.`);
    }
    
    // 1초 대기
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('실행 시간이 초과되었습니다.');
} 