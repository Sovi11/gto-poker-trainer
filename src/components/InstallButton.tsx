import { useState } from 'react';
import { useInstallPrompt } from '../lib/useInstallPrompt';
import { usePersistentState } from '../lib/usePersistentState';

// A quiet "Install" affordance in the top bar. Chromium gets the native
// prompt; iOS Safari gets the Share-menu steps, since it has no prompt API.
export function InstallButton() {
  const { canInstall, promptInstall, needsManualSteps } = useInstallPrompt();
  const [dismissed, setDismissed] = usePersistentState<boolean>('ui.installDismissed', false);
  const [showSteps, setShowSteps] = useState(false);

  if (!canInstall || dismissed) return null;

  const onClick = async () => {
    if (needsManualSteps) {
      setShowSteps((s) => !s);
      return;
    }
    const outcome = await promptInstall();
    if (outcome === 'dismissed') setDismissed(true);
  };

  return (
    <div className="install-wrap">
      <button className="install-btn" onClick={onClick} title="Install as an app">
        <span aria-hidden="true">⬇</span> Install
      </button>
      {showSteps && (
        <div className="install-steps">
          <strong>Add to your home screen</strong>
          <ol>
            <li>
              Tap the Share button
              <svg className="ios-share" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 3v12M12 3l-3.5 3.5M12 3l3.5 3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              in Safari
            </li>
            <li>Choose “Add to Home Screen”</li>
          </ol>
          <button
            className="link-btn"
            onClick={() => {
              setShowSteps(false);
              setDismissed(true);
            }}
          >
            don’t show this again
          </button>
        </div>
      )}
    </div>
  );
}
