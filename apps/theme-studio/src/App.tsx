import { NajmThemeProvider, NPortalScopeProvider } from "najm-kit";
import { StudioProvider } from "./app/studio-store";
import { StudioShell } from "./components/StudioShell";

export default function App() {
  return (
    <StudioProvider>
      <NPortalScopeProvider className="theme-studio">
        <NajmThemeProvider
          mode="dark"
          accent="violet"
          className="theme-studio h-full w-full"
        >
          <StudioShell />
        </NajmThemeProvider>
      </NPortalScopeProvider>
    </StudioProvider>
  );
}
