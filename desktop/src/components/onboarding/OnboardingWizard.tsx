import { useOnboardingStore, PROVIDERS } from "../../stores/onboarding-store";
import { useThemeStore } from "../../stores/theme-store";

export function OnboardingWizard() {
  const { theme } = useThemeStore();
  const c = theme.colors;
  const {
    step,
    provider,
    apiKey,
    model,
    baseUrl,
    setProvider,
    setApiKey,
    setModel,
    setBaseUrl,
    nextStep,
    prevStep,
    complete,
  } = useOnboardingStore();

  const selectedProvider = PROVIDERS.find((p) => p.id === provider);
  const isLocal = selectedProvider && !selectedProvider.needsApiKey;
  const needsBaseUrl = selectedProvider && (selectedProvider as { needsBaseUrl?: boolean }).needsBaseUrl;
  const hasModels = selectedProvider && selectedProvider.models.length > 0;

  const subtitles = [
    "Choose your AI provider",
    isLocal ? "Configure local endpoint" : "Enter your API key",
    "Select a model",
  ];

  const handleProviderSelect = (providerId: string) => {
    const p = PROVIDERS.find((pr) => pr.id === providerId);
    setProvider(providerId);
    if (p && !p.needsApiKey) {
      // Local providers: set apiKey to "local" and skip to model step
      setApiKey("local");
      nextStep();
      nextStep();
    } else {
      nextStep();
    }
  };

  const canProceedFromApiKey = isLocal || (apiKey.trim().length > 0);

  return (
    <div
      className="h-screen flex items-center justify-center"
      style={{ background: c.bg, color: c.text }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 flex flex-col gap-6"
        style={{ background: c.bgSecondary, border: `1px solid ${c.border}` }}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-4xl">🐶</span>
          <h1 className="text-2xl font-bold" style={{ color: c.text }}>
            Welcome to hanimo
          </h1>
          <p className="text-sm" style={{ color: c.textSecondary }}>
            {subtitles[step]}
          </p>
        </div>

        {/* Step 0: Provider selection */}
        {step === 0 && (
          <div className="flex flex-col gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => handleProviderSelect(p.id)}
                className="w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors"
                style={{
                  background: provider === p.id ? c.accent : c.bgTertiary,
                  color: provider === p.id ? "#ffffff" : c.text,
                  border: `1px solid ${provider === p.id ? c.accent : c.border}`,
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Step 1: API Key / Base URL */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            {needsBaseUrl && (
              <input
                type="text"
                placeholder="Base URL (e.g. https://api.example.com/v1)"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full rounded-lg px-4 py-3 text-sm outline-none"
                style={{
                  background: c.inputBg,
                  border: `1px solid ${c.inputBorder}`,
                  color: c.text,
                }}
              />
            )}
            <input
              type="password"
              placeholder="Enter your API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none"
              style={{
                background: c.inputBg,
                border: `1px solid ${c.inputBorder}`,
                color: c.text,
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={prevStep}
                className="flex-1 rounded-lg px-4 py-2 text-sm font-medium"
                style={{
                  background: c.bgTertiary,
                  color: c.textSecondary,
                  border: `1px solid ${c.border}`,
                }}
              >
                Back
              </button>
              <button
                onClick={nextStep}
                disabled={!canProceedFromApiKey}
                className="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-opacity"
                style={{
                  background: c.accent,
                  color: "#ffffff",
                  opacity: canProceedFromApiKey ? 1 : 0.4,
                  cursor: canProceedFromApiKey ? "pointer" : "not-allowed",
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Model selection */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {hasModels ? (
                selectedProvider.models.map((m) => (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    className="w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors"
                    style={{
                      background: model === m ? c.accent : c.bgTertiary,
                      color: model === m ? "#ffffff" : c.text,
                      border: `1px solid ${model === m ? c.accent : c.border}`,
                    }}
                  >
                    {m}
                  </button>
                ))
              ) : (
                <input
                  type="text"
                  placeholder="Enter model name (e.g. llama3.2, mistral)"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none"
                  style={{
                    background: c.inputBg,
                    border: `1px solid ${c.inputBorder}`,
                    color: c.text,
                  }}
                />
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={prevStep}
                className="flex-1 rounded-lg px-4 py-2 text-sm font-medium"
                style={{
                  background: c.bgTertiary,
                  color: c.textSecondary,
                  border: `1px solid ${c.border}`,
                }}
              >
                Back
              </button>
              <button
                onClick={complete}
                className="flex-1 rounded-lg px-4 py-2 text-sm font-medium"
                style={{
                  background: c.accent,
                  color: "#ffffff",
                }}
              >
                Start
              </button>
            </div>
          </div>
        )}

        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {[0, 1, 2].map((dot) => (
            <div
              key={dot}
              className="w-2 h-2 rounded-full transition-colors"
              style={{
                background: dot <= step ? c.accent : c.border,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
