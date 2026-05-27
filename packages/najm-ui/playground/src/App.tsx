import React, { useState } from "react";
import LayoutPreview from "./sections/LayoutPreview";
import ButtonsPreview from "./sections/ButtonsPreview";
import InputsPreview from "./sections/InputsPreview";
import FormPreview from "./sections/FormPreview";
import FeedbackPreview from "./sections/FeedbackPreview";
import DialogPreview from "./sections/DialogPreview";
import MultiStepFormPreview from "./sections/MultiStepFormPreview";
import DataDisplayPreview from "./sections/DataDisplayPreview";

const sections = [
  { id: "layout", label: "Layout" },
  { id: "buttons", label: "Buttons" },
  { id: "inputs", label: "Inputs" },
  { id: "form", label: "Form" },
  { id: "feedback", label: "Feedback" },
  { id: "dialogs", label: "Dialogs" },
  { id: "multistep", label: "Multi-Step" },
  { id: "datadisplay", label: "Data Display" },
];

const sectionComponents: Record<string, React.ComponentType> = {
  layout: LayoutPreview,
  buttons: ButtonsPreview,
  inputs: InputsPreview,
  form: FormPreview,
  feedback: FeedbackPreview,
  dialogs: DialogPreview,
  multistep: MultiStepFormPreview,
  datadisplay: DataDisplayPreview,
};

export default function App() {
  const [active, setActive] = useState("buttons");
  const ActiveSection = sectionComponents[active];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-4">
        <h1 className="text-xl font-bold">Najm UI Preview</h1>
      </header>
      <nav className="border-b px-6 py-2 flex gap-4">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active === s.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <main className="p-6 max-w-5xl mx-auto space-y-8">
        {ActiveSection && <ActiveSection />}
      </main>
    </div>
  );
}
