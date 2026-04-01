import { Sidebar } from "./components/layout/Sidebar";
import { FileTree } from "./components/layout/FileTree";
import { EditorArea } from "./components/layout/EditorArea";
import { ChatPanel } from "./components/layout/ChatPanel";
import { SettingsPanel } from "./components/settings/SettingsPanel";
import { StatusBar } from "./components/layout/StatusBar";
import { useThemeStore } from "./stores/theme-store";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { useOnboardingStore } from "./stores/onboarding-store";
import { useSidebarStore } from "./stores/sidebar-store";

export function App() {
  const { theme } = useThemeStore();
  const c = theme.colors;
  const { completed } = useOnboardingStore();
  const { activePanel } = useSidebarStore();

  if (!completed) return <OnboardingWizard />;

  return (
    <div className="h-screen flex flex-col" style={{ background: c.bg, color: c.text }}>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        {activePanel === "settings" ? <SettingsPanel /> : <FileTree />}
        <EditorArea />
        <ChatPanel />
      </div>
      <StatusBar />
    </div>
  );
}
