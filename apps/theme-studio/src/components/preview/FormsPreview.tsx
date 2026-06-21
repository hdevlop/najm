import { useState } from "react";
import {
  TextInput,
  NumberInput,
  PasswordInput,
  TextAreaInput,
  SelectInput,
  CheckboxInput,
  SwitchInput,
  DateInput,
  SliderInput,
  ColorPickerInput,
  NCard,
  NButton,
  Label,
} from "najm-kit";
import { SelectablePreviewElement } from "../SelectablePreviewElement";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function FormsPreview() {
  const [text, setText] = useState("Jane Doe");
  const [num, setNum] = useState<number>(3);
  const [pass, setPass] = useState("");
  const [bio, setBio] = useState("");
  const [role, setRole] = useState("teacher");
  const [agree, setAgree] = useState(true);
  const [notify, setNotify] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [slider, setSlider] = useState(40);
  const [color, setColor] = useState("oklch(0.62 0.24 292)");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: "var(--section-gap)" }}>
      <SelectablePreviewElement component="input">
        <NCard title="Profile">
          <div className="flex flex-col gap-3">
            <Row label="Full name">
              <TextInput value={text} onChange={setText} />
            </Row>
            <Row label="Class size">
              <NumberInput value={num} onChange={setNum} />
            </Row>
            <Row label="Password">
              <PasswordInput value={pass} onChange={setPass} placeholder="••••••" />
            </Row>
            <Row label="Role">
              <SelectInput
                value={role}
                onChange={setRole}
                items={["teacher", "admin", "student"]}
              />
            </Row>
            <Row label="Bio">
              <TextAreaInput value={bio} onChange={setBio} rows={3} placeholder="A short bio…" />
            </Row>
          </div>
        </NCard>
      </SelectablePreviewElement>

      <SelectablePreviewElement component="input">
        <NCard title="Preferences">
          <div className="flex flex-col gap-3">
            <Row label="Start date">
              <DateInput value={date} onChange={(d) => setDate(d ? new Date(d) : undefined)} />
            </Row>
            <Row label={`Volume (${slider})`}>
              <SliderInput value={slider} onChange={setSlider} />
            </Row>
            <Row label="Accent color">
              <ColorPickerInput mode="popover" output="oklch" value={color} onChange={setColor} />
            </Row>
            <CheckboxInput value={agree} onChange={setAgree} label="I agree to the terms" />
            <SwitchInput value={notify} onChange={setNotify} label="Email notifications" />
            <Row label="Disabled field">
              <TextInput value="Read only" onChange={() => {}} disabled />
            </Row>
            <div className="flex justify-end gap-2 pt-2">
              <NButton variant="outline">Cancel</NButton>
              <NButton>Save</NButton>
            </div>
          </div>
        </NCard>
      </SelectablePreviewElement>
    </div>
  );
}
