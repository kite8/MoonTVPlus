import { NextResponse } from 'next/server';

import { embyManager } from '@/lib/emby-manager';

export const runtime = 'nodejs';

/**
 * 获取所有启用的Emby源列表
 */
export async function GET() {
  try {
    console.log('[Emby Sources API] 开始获取Emby源列表');
    const sources = await embyManager.getEnabledSources();
    console.log('[Emby Sources API] 获取到的源数量:', sources.length);
    console.log('[Emby Sources API] 源详情:', JSON.stringify(sources, null, 2));

    return NextResponse.json({
      sources: sources.map(s => ({
        key: s.key,
        name: s.name,
      })),
    });
  } catch (error) {
    console.error('[Emby Sources] 获取Emby源列表失败:', error);
    return NextResponse.json(
      { error: '获取Emby源列表失败', sources: [] },
      { status: 500 }
    );
  }
}
