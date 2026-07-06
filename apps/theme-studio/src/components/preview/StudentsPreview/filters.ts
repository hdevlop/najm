import { smsClasses } from "./data";

export const studentFilters = [
  {
    name: "name",
    placeholder: "Search by name or number",
    type: "text",
    className: "w-full lg:w-64",
  },
  {
    name: "class",
    placeholder: "Filter by class",
    type: "combobox",
    options: smsClasses.map((classItem) => ({ value: classItem.name, label: classItem.name })),
    className: "w-full lg:w-48",
  },
  {
    name: "section",
    placeholder: "Filter by section",
    type: "select",
    options: ["A", "B", "C", "D", "E"].map((section) => ({ value: section, label: section })),
    className: "w-full lg:w-48",
  },
];
