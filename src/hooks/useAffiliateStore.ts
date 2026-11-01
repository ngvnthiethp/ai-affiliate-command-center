import { useState, useCallback, useEffect } from 'react';
import {
  AIAgent,
  AIAgentId,
  AuthUser,
  Campaign,
  ContentScript,
  CronTask,
  DailyMetricRecord,
  DailyPerformance,
  DashboardMetric,
  ModuleType,
  ProductItem,
  ScriptStatus,
  SystemLog,
  ToastMessage
} from '../types';
import {
  initialAgents,
  initialCampaigns,
  initialCronTasks,
  initialMetrics,
  initialProducts,
  initialScripts,
  initialSystemLogs,
  sevenDayPerformance as initialSevenDayPerformance
} from '../data/mockData';
import { authService, isSupabaseConfigured } from '../lib/supabase';
import { productService } from '../services/productService';
import { contentService } from '../services/contentService';
import { campaignService } from '../services/campaignService';
import { metricsService } from '../services/metricsService';
import { aiLogService } from '../services/aiLogService';

export function useAffiliateStore() {
  const [currentModule, setCurrentModule] = useState<ModuleType>('dashboard');
  const [viewMode, setViewMode] = useState<'iphone' | 'fullscreen'>('iphone');
  const [isKillSwitchActive, setIsKillSwitchActive] = useState<boolean>(false);
  
  // Auth state
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isMetricModalOpen, setIsMetricModalOpen] = useState<boolean>(false);

  // Data Source filter: 'all' (both) | 'real_only' (Supabase live) | 'demo_only' (Sandbox)
  const [dataSourceFilter, setDataSourceFilter] = useState<'all' | 'real_only' | 'demo_only'>('all');

  // Core Data States
  const [metrics, setMetrics] = useState<DashboardMetric>(initialMetrics);
  const [dailyPerformanceList, setDailyPerformanceList] = useState<DailyPerformance[]>(initialSevenDayPerformance);
  const [realDailyRecords, setRealDailyRecords] = useState<DailyMetricRecord[]>([]);

  const [agents, setAgents] = useState<AIAgent[]>(initialAgents);
  const [products, setProducts] = useState<ProductItem[]>(initialProducts);
  const [scripts, setScripts] = useState<ContentScript[]>(initialScripts);
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [cronTasks, setCronTasks] = useState<CronTask[]>(initialCronTasks);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>(initialSystemLogs);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // Selected product passed directly to Content Factory for generation
  const [selectedProductForScript, setSelectedProductForScript] = useState<ProductItem | null>(null);

  // Helper to add toast
  const addToast = useCallback((text: string, type: ToastMessage['type'] = 'success') => {
    const id = Date.now().toString() + Math.random().toString().slice(2, 6);
    setToasts((prev) => [...prev, { id, text, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Auto remove toasts after 3.5 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 3500);
    return () => clearTimeout(timer);
  }, [toasts]);

  // Add system log (both local and Supabase)
  const addSystemLog = useCallback(async (
    level: SystemLog['level'],
    source: SystemLog['source'],
    message: string
  ): Promise<{ error: string | null }> => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const newLog: SystemLog = {
      id: 'log-' + Date.now(),
      timestamp: timeStr,
      level,
      source,
      message,
      isDemo: false
    };

    setSystemLogs((prev) => [newLog, ...prev.slice(0, 99)]);

    if (isSupabaseConfigured()) {
      try {
        const res = await aiLogService.logAITask({
          level,
          source,
          message
        });
        if (res.error) {
          return { error: res.error };
        }
      } catch (err: any) {
        return { error: err?.message || 'Lỗi khi ghi nhật ký hệ thống' };
      }
    }
    return { error: null };
  }, []);

  // Initialize Supabase Auth Session listener
  useEffect(() => {
    const initAuth = async () => {
      if (!isSupabaseConfigured()) return;
      try {
        const session = await authService.getSession();
        if (session?.user) {
          setCurrentUser({
            id: session.user.id,
            email: session.user.email || 'Admin',
            role: session.user.role,
            lastSignInAt: session.user.last_sign_in_at
          });
        }
      } catch (err) {
        console.error('Lỗi khởi tạo session:', err);
      }
    };

    initAuth();

    const { unsubscribe } = authService.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser({
          id: session.user.id,
          email: session.user.email || 'Admin',
          role: session.user.role,
          lastSignInAt: session.user.last_sign_in_at
        });
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Fetch real data from Supabase tables
  const syncSupabaseData = useCallback(async (showToastNotice = false) => {
    if (!isSupabaseConfigured()) {
      if (showToastNotice) {
        addToast('Đang ở chế độ Sandbox Demo. Cấu hình Supabase để tải dữ liệu thật.', 'info');
      }
      return;
    }

    if (showToastNotice) {
      addToast('Đang đồng bộ dữ liệu từ Supabase PostgreSQL...', 'info');
    }

    try {
      // 1. Products
      const { data: dbProducts, error: prodErr } = await productService.fetchProducts();
      if (!prodErr && dbProducts && dbProducts.length > 0) {
        setProducts((prev) => {
          const demoItems = prev.filter((p) => p.isDemo);
          return [...dbProducts, ...demoItems];
        });
      }

      // 2. Content Drafts
      const { data: dbDrafts, error: draftErr } = await contentService.fetchContentDrafts();
      if (!draftErr && dbDrafts && dbDrafts.length > 0) {
        setScripts((prev) => {
          const demoScripts = prev.filter((s) => s.isDemo);
          return [...dbDrafts, ...demoScripts];
        });
      }

      // 3. Campaigns
      const { data: dbCamps, error: campErr } = await campaignService.fetchCampaigns();
      if (!campErr && dbCamps && dbCamps.length > 0) {
        setCampaigns((prev) => {
          const demoCamps = prev.filter((c) => c.isDemo);
          return [...dbCamps, ...demoCamps];
        });
      }

      // 4. Daily Metrics
      const { data: dbMetrics, error: metricErr } = await metricsService.fetchDailyMetrics();
      if (!metricErr && dbMetrics && dbMetrics.length > 0) {
        setRealDailyRecords(dbMetrics);
        const calculated = metricsService.computeRealDashboardSummary(dbMetrics);
        if (calculated.performance7D.length > 0) {
          setDailyPerformanceList(calculated.performance7D);
        }
      }

      // 5. AI Task Logs
      const { data: dbLogs, error: logErr } = await aiLogService.fetchAITaskLogs();
      if (!logErr && dbLogs && dbLogs.length > 0) {
        setSystemLogs((prev) => {
          const demoLogs = prev.filter((l) => l.isDemo);
          return [...dbLogs, ...demoLogs];
        });
      }

      if (showToastNotice) {
        addToast('Đồng bộ dữ liệu Supabase thành công!', 'success');
      }
    } catch (err: any) {
      console.warn('Lỗi đồng bộ Supabase:', err);
      if (showToastNotice) {
        addToast(`Lỗi đồng bộ: ${err?.message || 'Không thể kết nối bảng'}`, 'warning');
      }
    }
  }, [addToast]);

  // Initial load
  useEffect(() => {
    syncSupabaseData(false);
  }, [syncSupabaseData]);

  // Recalculate metrics based on current dataSourceFilter
  const displayedMetrics = useCallback((): { metrics: DashboardMetric; chartData: DailyPerformance[] } => {
    if (dataSourceFilter === 'real_only') {
      const computed = metricsService.computeRealDashboardSummary(realDailyRecords);
      return {
        metrics: computed.metrics,
        chartData: computed.performance7D
      };
    }

    if (dataSourceFilter === 'demo_only') {
      return {
        metrics: initialMetrics,
        chartData: initialSevenDayPerformance
      };
    }

    // Default 'all': If there are real records, show them; otherwise fallback to initialMetrics
    if (realDailyRecords.length > 0) {
      const computed = metricsService.computeRealDashboardSummary(realDailyRecords);
      return {
        metrics: {
          ...computed.metrics,
          activeAgentsCount: 5,
          activeCampaignsCount: campaigns.filter((c) => c.status === 'running').length
        },
        chartData: computed.performance7D
      };
    }

    return {
      metrics: {
        ...metrics,
        activeCampaignsCount: campaigns.filter((c) => c.status === 'running').length
      },
      chartData: dailyPerformanceList
    };
  }, [dataSourceFilter, realDailyRecords, metrics, dailyPerformanceList, campaigns]);

  // Emergency Kill Switch
  const toggleKillSwitch = useCallback(() => {
    setIsKillSwitchActive((prev) => {
      const nextState = !prev;
      if (nextState) {
        setAgents((prevAgents) =>
          prevAgents.map((a) => ({ ...a, status: 'paused' }))
        );
        addSystemLog('error', 'Hệ thống', 'LỆNH KHẨN CẤP: Đã kích hoạt Kill-Switch! Toàn bộ 5 AI Agent và cron job đã dừng 24/7.');
        addToast('Đã kích hoạt ngắt khẩn cấp! Toàn bộ AI đã tạm dừng.', 'error');
      } else {
        setAgents((prevAgents) =>
          prevAgents.map((a) => ({ ...a, status: 'active' }))
        );
        addSystemLog('success', 'Hệ thống', 'KHÔI PHỤC: Kill-Switch đã tắt. Hệ thống tự động hóa 24/7 tiếp tục vận hành.');
        addToast('Đã khôi phục hoạt động tự động hóa 24/7!', 'success');
      }
      return nextState;
    });
  }, [addSystemLog, addToast]);

  // AI Agent actions
  const toggleAgentStatus = useCallback((agentId: AIAgentId) => {
    setAgents((prev) =>
      prev.map((agent) => {
        if (agent.id === agentId) {
          const nextStatus = agent.status === 'active' ? 'paused' : 'active';
          addToast(
            `Agent ${agent.name} đã chuyển sang trạng thái: ${nextStatus === 'active' ? 'Hoạt động' : 'Tạm dừng'}`,
            nextStatus === 'active' ? 'success' : 'info'
          );
          addSystemLog(
            nextStatus === 'active' ? 'info' : 'warn',
            'Hệ thống',
            `Chuyển đổi trạng thái agent ${agent.name} thành ${nextStatus}.`
          );
          return { ...agent, status: nextStatus };
        }
        return agent;
      })
    );
  }, [addToast, addSystemLog]);

  const updateAgentPrompt = useCallback((agentId: AIAgentId, newPrompt: string) => {
    setAgents((prev) =>
      prev.map((agent) => {
        if (agent.id === agentId) {
          return { ...agent, systemPrompt: newPrompt };
        }
        return agent;
      })
    );
    addToast('Đã lưu cấu hình System Prompt mới cho Agent!', 'success');
    addSystemLog('info', 'Hệ thống', `Cập nhật cấu hình prompt cho Agent ${agentId}.`);
  }, [addToast, addSystemLog]);

  const testRunAgent = useCallback((agentId: AIAgentId, actualTokens?: number, skipSecondaryLog?: boolean) => {
    const target = agents.find((a) => a.id === agentId);
    if (!target) return;

    const addedTokens = actualTokens || (Math.floor(Math.random() * 800) + 400);

    setAgents((prev) =>
      prev.map((a) => {
        if (a.id === agentId) {
          return {
            ...a,
            tokenUsedToday: Math.min(a.tokenLimit, a.tokenUsedToday + addedTokens),
            tasksCompleted: a.tasksCompleted + 1,
            lastActive: 'Vừa xong'
          };
        }
        return a;
      })
    );

    if (!skipSecondaryLog) {
      addToast(`Thử nghiệm thành công! Đã tiêu thụ ${addedTokens.toLocaleString()} token.`, 'success');
      addSystemLog(
        'success',
        target.name.includes('Scout') ? 'Scout AI' :
        target.name.includes('Copywriter') ? 'Copywriter AI' :
        target.name.includes('Visual') ? 'Visual AI' :
        target.name.includes('Ads') ? 'Ads AI' : 'Auditor AI',
        `Chạy thử nghiệm hoàn tất. Tiêu tốn ${addedTokens} tokens.`
      );
    }
  }, [agents, addToast, addSystemLog]);

  // Product Hunter actions
  const sendProductToScriptFactory = useCallback((product: ProductItem) => {
    setSelectedProductForScript(product);
    setCurrentModule('content-factory');
    addToast(`Đã chuyển sản phẩm "${product.name.slice(0, 30)}..." sang Xưởng Kịch Bản`, 'info');
    addSystemLog('info', 'Scout AI', `Chuyển giao deal ${product.name} cho Copywriter AI xử lý kịch bản.`);
  }, [addToast, addSystemLog]);

  const copyToClipboard = useCallback((text: string, label: string = 'Nội dung') => {
    navigator.clipboard?.writeText(text);
    addToast(`Đã sao chép ${label} vào bộ nhớ tạm!`, 'success');
  }, [addToast]);

  const addCustomProduct = useCallback(async (product: ProductItem) => {
    let insertSucceeded = false;
    let savedProduct: ProductItem = product;

    if (isSupabaseConfigured()) {
      const { data: dbItem, error } = await productService.createProduct(product);
      if (error) {
        addToast(`Lỗi lưu Supabase [Thêm sản phẩm]:\n${error}`, 'error');
        // Do NOT treat as successful DB save; keep locally as offline draft
        setProducts((prev) => [{ ...product, isDemo: false }, ...prev]);
      } else if (dbItem) {
        insertSucceeded = true;
        savedProduct = dbItem;
        setProducts((prev) => [dbItem, ...prev]);
        addToast('Đã lưu sản phẩm thành công vào Supabase (bảng products)!', 'success');
      }
    } else {
      setProducts((prev) => [{ ...product, isDemo: false }, ...prev]);
      addToast('Đã thêm sản phẩm mới (chế độ cục bộ)!', 'success');
    }

    // Secondary operation: Ghi nhật ký hệ thống
    const logResult = await addSystemLog('success', 'Scout AI', `Thêm deal sản phẩm: ${savedProduct.name} (${savedProduct.platform.toUpperCase()}).`);
    if (logResult?.error && insertSucceeded) {
      addToast(`Lưu ý thao tác phụ:\nSản phẩm đã lưu thành công vào bảng products, nhưng ghi log thất bại:\n${logResult.error}`, 'warning');
    }
  }, [addToast, addSystemLog]);

  const updateCustomProduct = useCallback(async (id: string, updates: Partial<ProductItem>) => {
    let updateSucceeded = false;

    if (isSupabaseConfigured() && !id.startsWith('prod-0')) {
      const { success, error } = await productService.updateProduct(id, updates);
      if (!success && error) {
        addToast(`Lỗi lưu Supabase [Sửa sản phẩm]:\n${error}`, 'error');
      } else {
        updateSucceeded = true;
        addToast('Đã cập nhật sản phẩm thành công vào Supabase (bảng products)!', 'success');
      }
    } else {
      addToast('Đã cập nhật sản phẩm (chế độ cục bộ)!', 'success');
    }

    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );

    const logResult = await addSystemLog('info', 'Scout AI', `Cập nhật deal sản phẩm: ${updates.name || id}.`);
    if (logResult?.error && updateSucceeded) {
      addToast(`Lưu ý thao tác phụ:\nSản phẩm đã cập nhật vào bảng products, nhưng ghi log thất bại:\n${logResult.error}`, 'warning');
    }
  }, [addToast, addSystemLog]);

  const deleteCustomProduct = useCallback(async (id: string) => {
    if (isSupabaseConfigured() && !id.startsWith('prod-0')) {
      const { success, error } = await productService.deleteProduct(id);
      if (!success && error) {
        addToast(`Lỗi xóa Supabase [Xóa sản phẩm]:\n${error}`, 'error');
        return;
      }
    }
    setProducts((prev) => prev.filter((p) => p.id !== id));
    addToast('Đã xóa sản phẩm thành công!', 'success');
    addSystemLog('info', 'Scout AI', `Đã xóa deal sản phẩm ID: ${id}`);
  }, [addToast, addSystemLog]);

  // Content Factory actions
  const approveScript = useCallback(async (scriptId: string) => {
    setScripts((prev) =>
      prev.map((s) => {
        if (s.id === scriptId) {
          return { ...s, status: 'approved' as ScriptStatus };
        }
        return s;
      })
    );

    if (isSupabaseConfigured() && !scriptId.startsWith('script-0')) {
      await contentService.updateContentDraft(scriptId, { status: 'approved' });
    }

    addToast('Kịch bản đã được phê duyệt! Sẵn sàng đưa vào quay dựng.', 'success');
    addSystemLog('success', 'Auditor AI', `Phê duyệt kịch bản ID: ${scriptId}. Không phát hiện từ khóa vi phạm.`);
  }, [addToast, addSystemLog]);

  const toggleHookVariant = useCallback((scriptId: string) => {
    setScripts((prev) =>
      prev.map((s) => {
        if (s.id === scriptId) {
          const nextHook = s.activeHook === 'A' ? 'B' : 'A';
          addToast(`Đã chuyển sang Hook biến thể ${nextHook}`, 'info');
          return { ...s, activeHook: nextHook };
        }
        return s;
      })
    );
  }, [addToast]);

  const createScript = useCallback(async (newScript: ContentScript) => {
    let insertSucceeded = false;

    if (isSupabaseConfigured()) {
      const { data: dbDraft, error } = await contentService.createContentDraft(newScript);
      if (error) {
        addToast(`Lỗi lưu Supabase [Tạo kịch bản]:\n${error}`, 'error');
        setScripts((prev) => [{ ...newScript, isDemo: false }, ...prev]);
      } else if (dbDraft) {
        insertSucceeded = true;
        setScripts((prev) => [dbDraft, ...prev]);
        addToast('Đã lưu kịch bản thành công vào Supabase (bảng content_drafts)!', 'success');
      }
    } else {
      setScripts((prev) => [{ ...newScript, isDemo: false }, ...prev]);
      addToast('Đã tạo kịch bản mới thành công bằng AI!', 'success');
    }

    // Secondary operation: Ghi nhật ký hệ thống
    const logResult = await addSystemLog('success', 'Copywriter AI', `Sản xuất kịch bản video: "${newScript.title}". Tối ưu chuyển đổi TikTok Shop.`);
    if (logResult?.error && insertSucceeded) {
      addToast(`Lưu ý thao tác phụ:\nKịch bản đã lưu thành công vào content_drafts, nhưng ghi log thất bại:\n${logResult.error}`, 'warning');
    }
  }, [addToast, addSystemLog]);

  const downloadScriptTxt = useCallback((script: ContentScript) => {
    const content = `=====================================================
KỊCH BẢN TIKTOK/REELS AFFILIATE - AI COMMAND CENTER
=====================================================
Tên sản phẩm: ${script.productName}
Nền tảng: ${script.platform.toUpperCase()}
Thời lượng dự kiến: ${script.targetDuration}
Phong cách: ${script.tone}
Ngày tạo: ${script.createdAt}

[HOOK 3 GIÂY ĐẦU (Biến thể ${script.activeHook})]
${script.activeHook === 'A' ? script.hookVariantA : script.hookVariantB}

[CÂU CHUYỆN / GIẢI QUYẾT VẤN ĐỀ]
${script.bodyStory}

[PHÂN CẢNH VÀ LỜI THOẠI CHI TIẾT (VOICEOVER)]
${script.voiceoverLines.map((line, i) => `${i + 1}. [${line.timestamp}]
   - Hình ảnh / Góc quay: ${line.action}
   - Lời thoại: "${line.speech}"`).join('\n\n')}

[LỜI KÊU GỌI HÀNH ĐỘNG (CTA)]
${script.callToAction}

[HASHTAG VIRAL]
${script.hashtags.join(' ')}

---
Được sản xuất bởi AI Affiliate Command Center (ACC Vietnam)
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kich-ban-${script.id}-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('Đã tải kịch bản dạng .txt về máy!', 'success');
  }, [addToast]);

  // Campaign Center actions
  const toggleCampaignStatus = useCallback(async (campaignId: string) => {
    let nextStatus: 'running' | 'paused' = 'running';
    setCampaigns((prev) =>
      prev.map((c) => {
        if (c.id === campaignId) {
          nextStatus = c.status === 'running' ? 'paused' : 'running';
          addToast(`Chiến dịch đã ${nextStatus === 'running' ? 'kích hoạt' : 'tạm dừng'}!`, 'info');
          addSystemLog('info', 'Ads AI', `Chuyển trạng thái chiến dịch "${c.name}" sang ${nextStatus}.`);
          return { ...c, status: nextStatus };
        }
        return c;
      })
    );

    if (isSupabaseConfigured() && !campaignId.startsWith('camp-0')) {
      await campaignService.updateCampaign(campaignId, { status: nextStatus });
    }
  }, [addToast, addSystemLog]);

  const updateCampaignBudget = useCallback(async (campaignId: string, newBudget: number) => {
    setCampaigns((prev) =>
      prev.map((c) => {
        if (c.id === campaignId) {
          return { ...c, budgetVND: newBudget };
        }
        return c;
      })
    );

    if (isSupabaseConfigured() && !campaignId.startsWith('camp-0')) {
      await campaignService.updateCampaign(campaignId, { budgetVND: newBudget });
    }

    addToast('Đã cập nhật ngân sách chiến dịch!', 'success');
  }, [addToast]);

  const createCampaign = useCallback(async (campaign: Campaign) => {
    let insertSucceeded = false;

    if (isSupabaseConfigured()) {
      const { data: dbCamp, error } = await campaignService.createCampaign(campaign);
      if (error) {
        addToast(`Lỗi lưu Supabase [Tạo chiến dịch]:\n${error}`, 'error');
        setCampaigns((prev) => [{ ...campaign, isDemo: false }, ...prev]);
      } else if (dbCamp) {
        insertSucceeded = true;
        setCampaigns((prev) => [dbCamp, ...prev]);
        addToast('Đã khởi tạo chiến dịch vào bảng campaigns trên Supabase!', 'success');
      }
    } else {
      setCampaigns((prev) => [{ ...campaign, isDemo: false }, ...prev]);
      addToast('Đã khởi tạo chiến dịch affiliate mới!', 'success');
    }

    const logResult = await addSystemLog('success', 'Ads AI', `Khởi tạo chiến dịch mới: "${campaign.name}" với ngân sách ${campaign.budgetVND.toLocaleString()} VNĐ.`);
    if (logResult?.error && insertSucceeded) {
      addToast(`Lưu ý thao tác phụ:\nChiến dịch đã lưu thành công vào campaigns, nhưng ghi log thất bại:\n${logResult.error}`, 'warning');
    }
  }, [addToast, addSystemLog]);

  // Cron Task actions
  const runCronTaskNow = useCallback((taskId: string) => {
    const task = cronTasks.find((t) => t.id === taskId);
    if (!task) return;

    addToast(`Đang chạy tác vụ tự động: ${task.name}...`, 'info');

    setTimeout(() => {
      const nowTime = new Date().toTimeString().split(' ')[0].slice(0, 5);
      setCronTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            return {
              ...t,
              lastRunStatus: 'success',
              lastRunTime: `${nowTime} (Thủ công thành công)`
            };
          }
          return t;
        })
      );
      addToast(`Tác vụ "${task.name}" hoàn thành xuất sắc!`, 'success');
      addSystemLog('success', 'Hệ thống', `Kích hoạt tác vụ theo lịch: "${task.name}". Kết quả: Thành công.`);
    }, 1500);
  }, [cronTasks, addToast, addSystemLog]);

  // Add Manual Real Metric into Supabase daily_metrics
  const handleAddManualMetric = useCallback(async (entry: {
    metric_date: string;
    revenue_vnd: number;
    commission_vnd: number;
    total_orders: number;
    clicks: number;
    note?: string;
  }) => {
    let insertSucceeded = false;
    if (isSupabaseConfigured()) {
      const { data, error } = await metricsService.addDailyMetric(entry);
      if (error) {
        addToast(`Lỗi lưu Supabase [Số liệu ngày]:\n${error}`, 'error');
        return;
      }
      if (data) {
        insertSucceeded = true;
        setRealDailyRecords((prev) => [data, ...prev]);
        addToast(`Đã ghi nhận số liệu ngày ${entry.metric_date} vào Supabase!`, 'success');
      }
    } else {
      // Offline fallback
      const localRecord: DailyMetricRecord = {
        id: 'metric-' + Date.now(),
        ...entry,
        conversion_rate: entry.clicks > 0 ? Number(((entry.total_orders / entry.clicks) * 100).toFixed(2)) : 0,
        is_demo: false
      };
      setRealDailyRecords((prev) => [localRecord, ...prev]);
      addToast(`Đã lưu số liệu ngày ${entry.metric_date} (Bộ nhớ cục bộ)!`, 'success');
    }

    const logResult = await addSystemLog('success', 'Hệ thống', `Nhập số liệu thực tế: Doanh số ${entry.revenue_vnd.toLocaleString()}đ, Hoa hồng ${entry.commission_vnd.toLocaleString()}đ.`);
    if (logResult?.error && insertSucceeded) {
      addToast(`Lưu ý thao tác phụ:\nSố liệu đã lưu vào Supabase, nhưng ghi log thất bại:\n${logResult.error}`, 'warning');
    }
  }, [addToast, addSystemLog]);

  // Filter items by dataSourceFilter
  const filteredProducts = products.filter((p) => {
    if (dataSourceFilter === 'real_only') return !p.isDemo;
    if (dataSourceFilter === 'demo_only') return p.isDemo;
    return true;
  });

  const filteredScripts = scripts.filter((s) => {
    if (dataSourceFilter === 'real_only') return !s.isDemo;
    if (dataSourceFilter === 'demo_only') return s.isDemo;
    return true;
  });

  const filteredCampaigns = campaigns.filter((c) => {
    if (dataSourceFilter === 'real_only') return !c.isDemo;
    if (dataSourceFilter === 'demo_only') return c.isDemo;
    return true;
  });

  const filteredLogs = systemLogs.filter((l) => {
    if (dataSourceFilter === 'real_only') return !l.isDemo;
    if (dataSourceFilter === 'demo_only') return l.isDemo;
    return true;
  });

  return {
    currentModule,
    setCurrentModule,
    viewMode,
    setViewMode,
    isKillSwitchActive,
    toggleKillSwitch,
    
    // Auth & Supabase config
    currentUser,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isMetricModalOpen,
    setIsMetricModalOpen,
    dataSourceFilter,
    setDataSourceFilter,
    syncSupabaseData,
    handleAddManualMetric,

    // Metrics
    metrics: displayedMetrics().metrics,
    chartPerformance7D: displayedMetrics().chartData,
    realDailyRecords,
    
    // AI Agents
    agents,
    toggleAgentStatus,
    updateAgentPrompt,
    testRunAgent,
    
    // Products
    products: filteredProducts,
    allProductsCount: products.length,
    addCustomProduct,
    updateCustomProduct,
    deleteCustomProduct,
    sendProductToScriptFactory,
    selectedProductForScript,
    setSelectedProductForScript,
    
    // Content Scripts
    scripts: filteredScripts,
    allScriptsCount: scripts.length,
    approveScript,
    toggleHookVariant,
    createScript,
    downloadScriptTxt,
    
    // Campaigns
    campaigns: filteredCampaigns,
    allCampaignsCount: campaigns.length,
    toggleCampaignStatus,
    updateCampaignBudget,
    createCampaign,
    
    // Cron & Logs
    cronTasks,
    runCronTaskNow,
    systemLogs: filteredLogs,
    allLogsCount: systemLogs.length,
    clearSystemLogs: () => setSystemLogs([]),
    addSystemLog,
    
    // Utilities
    toasts,
    addToast,
    removeToast,
    copyToClipboard
  };
}
