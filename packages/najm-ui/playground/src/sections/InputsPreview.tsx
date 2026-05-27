import React, { useState } from "react";
import {
  TextInput,
  NumberInput,
  PasswordInput,
  TextAreaInput,
  SelectInput,
  SwitchInput,
  CheckboxInput,
  CheckboxGroupInput,
  ComboboxInput,
  TimeInput,
  DateInput,
  ColorPickerInput,
  EmojiInput,
  LangInput,
  ImageInput,
  PhoneInput,
} from "najm-ui";

const selectItems = [
  { value: "react", label: "React" },
  { value: "vue", label: "Vue" },
  { value: "angular", label: "Angular" },
];

const langItems = [
  { value: "en", label: "English", icon: "🇺🇸" },
  { value: "fr", label: "Français", icon: "🇫🇷" },
  { value: "ar", label: "العربية", icon: "🇲🇦" },
  { value: "es", label: "Español", icon: "🇪🇸" },
];

export default function InputsPreview() {
  const [text, setText] = useState("");
  const [number, setNumber] = useState(0);
  const [password, setPassword] = useState("");
  const [textarea, setTextarea] = useState("");
  const [select, setSelect] = useState("");
  const [switchVal, setSwitchVal] = useState(false);
  const [checkbox, setCheckbox] = useState(false);
  const [checkGroup, setCheckGroup] = useState<string[]>([]);
  const [combo, setCombo] = useState("");
  const [time, setTime] = useState("");
  const [date, setDate] = useState(undefined);
  const [color, setColor] = useState("#3B82F6");
  const [emoji, setEmoji] = useState(0);
  const [lang, setLang] = useState("en");
  const [image, setImage] = useState<File | string | null>(null);
  const [phone, setPhone] = useState("");

  return (
    <div className="space-y-6 max-w-md">
      <h2 className="text-lg font-semibold">Inputs</h2>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Text</label>
          <TextInput value={text} onChange={setText} placeholder="Type something..." />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Text (disabled)</label>
          <TextInput value="Disabled input" onChange={() => {}} disabled />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Text (error)</label>
          <TextInput value="" onChange={() => {}} status="error" placeholder="Required field" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Number</label>
          <NumberInput value={number} onChange={setNumber} placeholder="Enter a number" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Password</label>
          <PasswordInput value={password} onChange={setPassword} placeholder="Enter password" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Textarea</label>
          <TextAreaInput value={textarea} onChange={setTextarea} placeholder="Long text..." />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Select</label>
          <SelectInput value={select} onChange={setSelect} items={selectItems} placeholder="Choose one" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Combobox</label>
          <ComboboxInput value={combo} onChange={setCombo} items={selectItems} placeholder="Search and select" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Date</label>
          <DateInput value={date} onChange={setDate} placeholder="Pick a date" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Time</label>
          <TimeInput value={time} onChange={setTime} placeholder="HH:MM" />
        </div>
        <div>
          <SwitchInput value={switchVal} onChange={setSwitchVal} label="Enable feature" />
        </div>
        <div>
          <SwitchInput value={false} onChange={() => {}} label="Disabled switch" disabled />
        </div>
        <div>
          <CheckboxInput value={checkbox} onChange={setCheckbox} label="Accept terms" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Checkbox Group</label>
          <CheckboxGroupInput value={checkGroup} onChange={setCheckGroup} items={selectItems} layout="row" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Checkbox Group (disabled)</label>
          <CheckboxGroupInput value={["react"]} onChange={() => {}} items={selectItems} layout="row" disabled />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Color Picker</label>
          <ColorPickerInput value={color} onChange={setColor} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Color Picker (disabled)</label>
          <ColorPickerInput value="#EF4444" onChange={() => {}} disabled />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Emoji Rating</label>
          <EmojiInput value={emoji} onChange={setEmoji} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Emoji Rating (disabled)</label>
          <EmojiInput value={3} onChange={() => {}} disabled />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Language</label>
          <LangInput value={lang} onChange={setLang} items={langItems} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Phone</label>
          <PhoneInput value={phone} onChange={setPhone} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Phone (disabled)</label>
          <PhoneInput value="+1234567890" onChange={() => {}} disabled />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Image</label>
          <ImageInput value={image} onChange={setImage} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Image (disabled)</label>
          <ImageInput value={null} onChange={() => {}} disabled />
        </div>
      </div>
    </div>
  );
}
