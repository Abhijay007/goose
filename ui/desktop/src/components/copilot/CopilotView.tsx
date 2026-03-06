import { Bot } from 'lucide-react';
import { MainPanelLayout } from '../Layout/MainPanelLayout';

export default function CopilotView() {
  return (
    <MainPanelLayout>
      <div className="flex flex-col items-center justify-center h-full gap-4 text-text-secondary">
        <Bot className="w-12 h-12 opacity-40" />
        <p className="text-lg font-medium">Copilot</p>
        <p className="text-sm opacity-60">Coming soon</p>
      </div>
    </MainPanelLayout>
  );
}
