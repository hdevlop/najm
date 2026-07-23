import { themeProjectsTable } from '../modules/theme-project/ThemeProjectSchema';
import { themeStylesTable } from '../modules/theme-style/ThemeStyleSchema';

export { themeProjectsTable, themeStylesTable };

export const schema = {
  themeProjects: themeProjectsTable,
  themeStyles: themeStylesTable,
};