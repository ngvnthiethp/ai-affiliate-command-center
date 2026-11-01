/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAffiliateStore } from './hooks/useAffiliateStore';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { ToastContainer } from './components/common/Toast';
import { DashboardModule } from './components/dashboard/DashboardModule';
import { AiManagerModule } from './components/ai-manager/AiManagerModule';
import { ProductHunterModule } from './components/product-hunter/ProductHunterModule';
import { ContentFactoryModule } from './components/content-factory/ContentFactoryModule';
import { CampaignCenterModule } from './components/campaign-center/CampaignCenterModule';
import { SystemControlModule } from './components/system-control/SystemControlModule';
import { AuthModal } from './components/auth/AuthModal';
import { ManualMetricModal } from './components/dashboard/ManualMetricModal';
import { isSupabaseConfigured } from './lib/supabase';
import { Wifi, BatteryMedium, Signal } from 'lucide-react';

export default function App() {
  const store = useAffiliateStore();
  const [phoneTime] = useState(() => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col items-center justify-start overflow-x-hidden">
      {/* Toast feedback system */}
      <ToastContainer toasts={store.toasts} onDismiss={store.removeToast} />

      {/* Supabase Auth & Config Modal */}
      <AuthModal
        isOpen={store.isAuthModalOpen}
        onClose={() => store.setIsAuthModalOpen(false)}
        currentUser={store.currentUser}
        onAuthSuccess={(user) => {
          store.syncSupabaseData(true);
        }}
        onSignOut={() => {
          store.syncSupabaseData(false);
        }}
        onAddToast={store.addToast}
      />

      {/* Manual Real Metrics Entry Modal */}
      <ManualMetricModal
        isOpen={store.isMetricModalOpen}
        onClose={() => store.setIsMetricModalOpen(false)}
        onSubmit={store.handleAddManualMetric}
      />

      {/* Main Container Wrapper */}
      <div
        className={`w-full transition-all duration-300 ${
          store.viewMode === 'iphone'
            ? 'max-w-[430px] my-0 md:my-6 md:rounded-[44px] md:border-[10px] md:border-slate-800 md:shadow-[0_0_60px_rgba(0,240,255,0.12)] md:ring-1 md:ring-slate-700/60 overflow-hidden'
            : 'max-w-5xl my-0 px-2 sm:px-4 md:px-6'
        }`}
      >
        {/* iPhone Chassis Dynamic Island & Hardware Status Bar (Only visible in iPhone frame on desktop) */}
        {store.viewMode === 'iphone' && (
          <div className="hidden md:flex items-center justify-between px-6 pt-3 pb-1 bg-[#07090E] border-b border-slate-900/80 text-[11px] font-semibold text-slate-300 select-none">
            <span>{phoneTime}</span>
            {/* Dynamic Island pill */}
            <div className="w-24 h-5 bg-black rounded-full border border-slate-800 flex items-center justify-end px-2 gap-1.5 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-cyan-400/80 animate-pulse" />
            </div>
            <div className="flex items-center gap-1.5">
              <Signal className="w-3 h-3 text-slate-300" />
              <Wifi className="w-3 h-3 text-slate-300" />
              <BatteryMedium className="w-3.5 h-3.5 text-cyan-400" />
            </div>
          </div>
        )}

        {/* Global Sticky Header */}
        <Header
          viewMode={store.viewMode}
          setViewMode={store.setViewMode}
          isKillSwitchActive={store.isKillSwitchActive}
          onToggleKillSwitch={store.toggleKillSwitch}
          onSync={() => store.syncSupabaseData(true)}
          currentUser={store.currentUser}
          onOpenAuthModal={() => store.setIsAuthModalOpen(true)}
          dataSourceFilter={store.dataSourceFilter}
          setDataSourceFilter={store.setDataSourceFilter}
          isConfigured={isSupabaseConfigured()}
        />

        {/* Main Scrollable Viewport */}
        <main className="p-3 sm:p-4 min-h-[calc(100vh-140px)] bg-[#07090E]">
          {store.currentModule === 'dashboard' && (
            <DashboardModule
              metrics={store.metrics}
              chartPerformance7D={store.chartPerformance7D}
              onNavigate={store.setCurrentModule}
              onSync={() => store.syncSupabaseData(true)}
              products={store.products}
              onSelectProduct={store.sendProductToScriptFactory}
              onOpenManualMetricModal={() => store.setIsMetricModalOpen(true)}
              dataSourceFilter={store.dataSourceFilter}
              realMetricsCount={store.realDailyRecords.length}
            />
          )}

          {store.currentModule === 'ai-manager' && (
            <AiManagerModule
              agents={store.agents}
              products={store.products}
              scripts={store.scripts}
              currentUser={store.currentUser}
              onOpenAuthModal={() => store.setIsAuthModalOpen(true)}
              addToast={store.addToast}
              addSystemLog={store.addSystemLog}
              onToggleStatus={store.toggleAgentStatus}
              onUpdatePrompt={store.updateAgentPrompt}
              onTestRun={store.testRunAgent}
            />
          )}

          {store.currentModule === 'product-hunter' && (
            <ProductHunterModule
              products={store.products}
              onSelectProductForScript={store.sendProductToScriptFactory}
              onCopyLink={store.copyToClipboard}
              onAddProduct={store.addCustomProduct}
              onAddMultipleProducts={store.addMultipleProducts}
              onUpdateProduct={store.updateCustomProduct}
              onDeleteProduct={store.deleteCustomProduct}
              currentUser={store.currentUser}
              onOpenAuthModal={() => store.setIsAuthModalOpen(true)}
              addToast={store.addToast}
              addSystemLog={store.addSystemLog}
            />
          )}

          {store.currentModule === 'content-factory' && (
            <ContentFactoryModule
              scripts={store.scripts}
              products={store.products}
              selectedProductForScript={store.selectedProductForScript}
              currentUser={store.currentUser}
              onOpenAuthModal={() => store.setIsAuthModalOpen(true)}
              onNavigateToProductHunter={() => store.setCurrentModule('product-hunter')}
              addToast={store.addToast}
              addSystemLog={store.addSystemLog}
              onClearSelectedProduct={() => store.setSelectedProductForScript(null)}
              onApproveScript={store.approveScript}
              onToggleHookVariant={store.toggleHookVariant}
              onCopyText={store.copyToClipboard}
              onDownloadTxt={store.downloadScriptTxt}
              onCreateScript={store.createScript}
            />
          )}

          {store.currentModule === 'campaign-center' && (
            <CampaignCenterModule
              campaigns={store.campaigns}
              onToggleStatus={store.toggleCampaignStatus}
              onUpdateBudget={store.updateCampaignBudget}
              onCreateCampaign={store.createCampaign}
            />
          )}

          {store.currentModule === 'system-control' && (
            <SystemControlModule
              isKillSwitchActive={store.isKillSwitchActive}
              onToggleKillSwitch={store.toggleKillSwitch}
              cronTasks={store.cronTasks}
              onRunCronTask={store.runCronTaskNow}
              systemLogs={store.systemLogs}
              onClearLogs={store.clearSystemLogs}
              onCopyText={store.copyToClipboard}
            />
          )}
        </main>

        {/* Bottom Navigation Bar */}
        <BottomNav
          currentModule={store.currentModule}
          onChangeModule={store.setCurrentModule}
        />
      </div>
    </div>
  );
}
