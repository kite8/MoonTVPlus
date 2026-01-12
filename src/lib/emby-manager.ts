/* eslint-disable @typescript-eslint/no-explicit-any */

import { EmbyClient } from './emby.client';
import { getConfig } from './config';
import { AdminConfig } from './admin.types';

interface EmbySourceConfig {
  key: string;
  name: string;
  enabled: boolean;
  ServerURL: string;
  ApiKey?: string;
  Username?: string;
  Password?: string;
  UserId?: string;
  AuthToken?: string;
  Libraries?: string[];
  LastSyncTime?: number;
  ItemCount?: number;
  isDefault?: boolean;
  // 高级流媒体选项
  removeEmbyPrefix?: boolean;
  appendMediaSourceId?: boolean;
  transcodeMp4?: boolean;
  proxyPlay?: boolean; // 视频播放代理开关
}

class EmbyManager {
  private static instance: EmbyManager;
  private clients: Map<string, EmbyClient> = new Map();

  private constructor() {}

  static getInstance(): EmbyManager {
    if (!EmbyManager.instance) {
      EmbyManager.instance = new EmbyManager();
    }
    return EmbyManager.instance;
  }

  /**
   * 从配置中获取所有Emby源（支持新旧格式）
   */
  private async getSources(): Promise<EmbySourceConfig[]> {
    const config = await getConfig();
    console.log('[EmbyManager] 获取配置完成');
    console.log('[EmbyManager] EmbyConfig存在:', !!config.EmbyConfig);
    console.log('[EmbyManager] EmbyConfig.Sources存在:', !!config.EmbyConfig?.Sources);
    console.log('[EmbyManager] EmbyConfig.Sources是数组:', Array.isArray(config.EmbyConfig?.Sources));
    if (config.EmbyConfig?.Sources) {
      console.log('[EmbyManager] Sources长度:', config.EmbyConfig.Sources.length);
      console.log('[EmbyManager] Sources内容:', JSON.stringify(config.EmbyConfig.Sources, null, 2));
    }

    // 如果是新格式（Sources数组）
    if (config.EmbyConfig?.Sources && Array.isArray(config.EmbyConfig.Sources)) {
      console.log('[EmbyManager] 使用新格式Sources，返回', config.EmbyConfig.Sources.length, '个源');
      return config.EmbyConfig.Sources;
    }

    // 如果是旧格式（单源配置），转换为数组格式
    if (config.EmbyConfig?.ServerURL) {
      console.log('[EmbyManager] 使用旧格式配置，转换为数组');
      return [{
        key: 'default',
        name: 'Emby',
        enabled: config.EmbyConfig.Enabled ?? false,
        ServerURL: config.EmbyConfig.ServerURL,
        ApiKey: config.EmbyConfig.ApiKey,
        Username: config.EmbyConfig.Username,
        Password: config.EmbyConfig.Password,
        UserId: config.EmbyConfig.UserId,
        AuthToken: config.EmbyConfig.AuthToken,
        Libraries: config.EmbyConfig.Libraries,
        LastSyncTime: config.EmbyConfig.LastSyncTime,
        ItemCount: config.EmbyConfig.ItemCount,
        isDefault: true,
      }];
    }

    console.log('[EmbyManager] 没有找到任何Emby配置，返回空数组');
    return [];
  }

  /**
   * 获取指定key的EmbyClient
   * @param key Emby源的key，如果不指定则使用默认源
   */
  async getClient(key?: string): Promise<EmbyClient> {
    const sources = await this.getSources();

    if (sources.length === 0) {
      throw new Error('未配置 Emby 源');
    }

    // 如果没有指定key，使用默认源（第一个或标记为default的）
    if (!key) {
      const defaultSource = sources.find(s => s.isDefault) || sources[0];
      key = defaultSource.key;
    }

    // 从缓存获取或创建新实例
    if (!this.clients.has(key)) {
      const sourceConfig = sources.find(s => s.key === key);
      if (!sourceConfig) {
        throw new Error(`未找到 Emby 源: ${key}`);
      }

      if (!sourceConfig.enabled) {
        throw new Error(`Emby 源已禁用: ${sourceConfig.name}`);
      }

      this.clients.set(key, new EmbyClient(sourceConfig));
    }

    return this.clients.get(key)!;
  }

  /**
   * 获取所有启用的EmbyClient
   */
  async getAllClients(): Promise<Map<string, { client: EmbyClient; config: EmbySourceConfig }>> {
    const sources = await this.getSources();
    const enabledSources = sources.filter(s => s.enabled);
    const result = new Map<string, { client: EmbyClient; config: EmbySourceConfig }>();

    for (const source of enabledSources) {
      if (!this.clients.has(source.key)) {
        this.clients.set(source.key, new EmbyClient(source));
      }
      result.set(source.key, {
        client: this.clients.get(source.key)!,
        config: source,
      });
    }

    return result;
  }

  /**
   * 获取所有启用的Emby源配置
   */
  async getEnabledSources(): Promise<EmbySourceConfig[]> {
    console.log('[EmbyManager] getEnabledSources 被调用');
    const sources = await this.getSources();
    console.log('[EmbyManager] 获取到所有源:', sources.length, '个');
    const enabledSources = sources.filter(s => s.enabled);
    console.log('[EmbyManager] 过滤后启用的源:', enabledSources.length, '个');
    return enabledSources;
  }

  /**
   * 检查是否配置了Emby
   */
  async hasEmby(): Promise<boolean> {
    const sources = await this.getSources();
    return sources.some(s => s.enabled && s.ServerURL);
  }

  /**
   * 清除缓存的客户端实例
   */
  clearCache() {
    this.clients.clear();
  }
}

export const embyManager = EmbyManager.getInstance();

/**
 * 配置迁移函数：将旧格式配置迁移到新格式
 */
export function migrateEmbyConfig(config: AdminConfig): AdminConfig {
  // 如果已经是新格式，直接返回
  if (config.EmbyConfig?.Sources) {
    return config;
  }

  // 如果是旧格式，迁移到新格式
  if (config.EmbyConfig && config.EmbyConfig.ServerURL) {
    const oldConfig = config.EmbyConfig;
    config.EmbyConfig = {
      Sources: [{
        key: 'default',
        name: 'Emby',
        enabled: oldConfig.Enabled ?? false,
        ServerURL: oldConfig.ServerURL || '',
        ApiKey: oldConfig.ApiKey,
        Username: oldConfig.Username,
        Password: oldConfig.Password,
        UserId: oldConfig.UserId,
        AuthToken: oldConfig.AuthToken,
        Libraries: oldConfig.Libraries,
        LastSyncTime: oldConfig.LastSyncTime,
        ItemCount: oldConfig.ItemCount,
        isDefault: true,
        // 高级选项默认值
        removeEmbyPrefix: false,
        appendMediaSourceId: false,
        transcodeMp4: false,
        proxyPlay: false,
      }],
    };
  }

  return config;
}
