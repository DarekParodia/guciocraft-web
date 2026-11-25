function DownloadButton({ kind, available }) {
  const label = kind === 'portable' ? 'Pobierz zestaw dla Windows' : 'Pobierz modpack .zip';
  return <div className="download">
    {available
      ? <a href={`/api/downloads/${kind}`} className={`button ${kind === 'modpack' ? 'button-outline' : ''}`}>{label}</a>
      : <><button className={`button ${kind === 'modpack' ? 'button-outline' : ''}`} type="button" disabled>{label}</button><span className="download-note">Plik w przygotowaniu</span></>}
  </div>;
}

export default function InstallGuide({ portableAvailable, modpackAvailable, ramGiB, address }) {
  return <div className="install-guide">
    <DownloadButton kind="portable" available={portableAvailable} />
    <ol className="steps">
      <li><strong>Wypakuj pobrany ZIP.</strong> W folderze „Pobrane” kliknij plik prawym przyciskiem i wybierz „Wyodrębnij wszystkie”.</li>
      <li><strong>Uruchom Prism.</strong> Otwórz <code>prismlauncher.exe</code> z wypakowanego folderu. W „Ustawienia → Konta” dodaj swoje konto Microsoft i uruchom instancję Guciocraft.</li>
      <li><strong>Wejdź na serwer.</strong> W grze wybierz „Tryb wieloosobowy → Dodaj serwer” i wpisz <code>{address}</code>.</li>
    </ol>
    <details className="alternative-install">
      <summary>Masz już Prism? Zainstaluj sam modpack</summary>
      <div className="alternative-content">
        <DownloadButton kind="modpack" available={modpackAvailable} />
        <ol className="steps">
          <li>Jeśli potrzebujesz launchera, pobierz go z <a href="https://prismlauncher.org/download/" target="_blank" rel="noreferrer">oficjalnej strony Prism ↗</a>. Wybierz swój system, zainstaluj program i dodaj konto w „Ustawienia → Konta”.</li>
          <li>W Prism wybierz „Dodaj instancję → Importuj” i wskaż pobrany ZIP. <strong>Nie wypakowuj go.</strong> Poczekaj na zakończenie importu.</li>
          <li>W „Ustawienia → Java” włącz automatyczne wykrywanie i pobieranie Javy, jeśli twoje wydanie Prism je obsługuje. {ramGiB ? `Przydziel grze ${ramGiB} GB RAM.` : 'Pozostaw pamięć również dla systemu; zalecenia dla paczki podamy przy pobraniu.'}</li>
          <li>Uruchom instancję Guciocraft i dodaj serwer <code>{address}</code> w trybie wieloosobowym.</li>
        </ol>
      </div>
    </details>
    <p className="install-note">Pierwszy start może potrwać kilka minut. Nową wersję paczki zainstaluj osobno, zachowując swoje światy i ustawienia.</p>
  </div>;
}
