// 三栏式工作台主页面
import { QuestionList } from "../components/QuestionList";
import { QuestionDetail } from "../components/QuestionDetail";
import { ImpactPanel } from "../components/ImpactPanel";
import { useWorkbench } from "../stores/workbench";

export function WorkbenchPage() {
  const { loadError } = useWorkbench();
  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">Game Decision Workbench</span>
        <span className="sub">人工裁决工作台 · AI 发现问题，人负责判断与批准</span>
        {loadError && <span className="load-error">加载失败：{loadError}</span>}
      </header>
      <main className="three-col">
        <QuestionList />
        <QuestionDetail />
        <ImpactPanel />
      </main>
    </div>
  );
}
