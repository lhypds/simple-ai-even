export type Locale = "en" | "ja" | "zh" | "zt" | "ko";

export interface Translations {
  appTitle: string;
  loginTitle: string;
  fieldUsername: string;
  fieldPassword: string;
  saveCredentials: string;
  btnCancel: string;
  btnLogin: string;
  settingsTitle: string;
  fieldApiKey: string;
  fieldSpeechLang: string;
  fieldTheme: string;
  toggleCursorBlink: string;
  toggleTranscription: string;
  btnSave: string;
  savedNote: string;
  versionPrefix: string;
  langAuto: string;
  themeLight: string;
  themeDark: string;
  themeTerminal: string;
  message: {
    noApiKey: string;
  };
}

const en: Translations = {
  appTitle: "Simple AI",
  loginTitle: "Login",
  fieldUsername: "Username",
  fieldPassword: "Password",
  saveCredentials: "Save credentials",
  btnCancel: "Cancel",
  btnLogin: "Login",
  settingsTitle: "Settings",
  fieldApiKey: "OpenAI API key (for voice transcription)",
  fieldSpeechLang: "Speech language",
  fieldTheme: "Theme",
  toggleCursorBlink: "Blink cursor",
  toggleTranscription: "Voice transcription",
  btnSave: "Save",
  savedNote: "Saved ✓",
  versionPrefix: "Version",
  langAuto: "Auto-detect",
  themeLight: "Light",
  themeDark: "Dark",
  themeTerminal: "Terminal",
  message: {
    noApiKey: "Open Settings and set OpenAI API key to start voice transcription.",
  },
};

const ja: Translations = {
  appTitle: "Simple AI",
  loginTitle: "ログイン",
  fieldUsername: "ユーザー名",
  fieldPassword: "パスワード",
  saveCredentials: "ログイン情報を保存する",
  btnCancel: "キャンセル",
  btnLogin: "ログイン",
  settingsTitle: "設定",
  fieldApiKey: "OpenAI APIキー（文字起こし用）",
  fieldSpeechLang: "音声言語",
  fieldTheme: "テーマ",
  toggleCursorBlink: "カーソル点滅",
  toggleTranscription: "文字起こし",
  btnSave: "保存",
  savedNote: "保存済み ✓",
  versionPrefix: "バージョン",
  langAuto: "自動検出",
  themeLight: "ライト",
  themeDark: "ダーク",
  themeTerminal: "ターミナル",
  message: {
    noApiKey: "設定を開いてOpenAI APIキーを設定すると音声認識が開始されます。",
  },
};

const zh: Translations = {
  appTitle: "Simple AI",
  loginTitle: "登录",
  fieldUsername: "用户名",
  fieldPassword: "密码",
  saveCredentials: "保存登入信息",
  btnCancel: "取消",
  btnLogin: "登录",
  settingsTitle: "设置",
  fieldApiKey: "OpenAI API 密钥（用于语音转录）",
  fieldSpeechLang: "语音语言",
  fieldTheme: "主题",
  toggleCursorBlink: "光标闪烁",
  toggleTranscription: "语音转录",
  btnSave: "保存",
  savedNote: "已保存 ✓",
  versionPrefix: "版本",
  langAuto: "自动检测",
  themeLight: "浅色",
  themeDark: "深色",
  themeTerminal: "终端",
  message: {
    noApiKey: "请打开设置并设置您的 OpenAI API 密钥以开始语音识别。",
  },
};

const zt: Translations = {
  appTitle: "Simple AI",
  loginTitle: "登入",
  fieldUsername: "使用者名稱",
  fieldPassword: "密碼",
  saveCredentials: "儲存登入資訊",
  btnCancel: "取消",
  btnLogin: "登入",
  settingsTitle: "設定",
  fieldApiKey: "OpenAI API 金鑰（文字轉錄用）",
  fieldSpeechLang: "語音語言",
  fieldTheme: "主題",
  toggleCursorBlink: "游標閃爍",
  toggleTranscription: "文字轉錄",
  btnSave: "儲存",
  savedNote: "已儲存 ✓",
  versionPrefix: "版本",
  langAuto: "自動偵測",
  themeLight: "淺色",
  themeDark: "深色",
  themeTerminal: "終端機",
  message: {
    noApiKey: "請開啟設定並設定您的 OpenAI API 金鑰以開始文字轉錄。",
  },
};

const ko: Translations = {
  appTitle: "Simple AI",
  loginTitle: "로그인",
  fieldUsername: "사용자 이름",
  fieldPassword: "비밀번호",
  saveCredentials: "로그인 정보 저장",
  btnCancel: "취소",
  btnLogin: "로그인",
  settingsTitle: "설정",
  fieldApiKey: "OpenAI API 키 (음성 전사용)",
  fieldSpeechLang: "음성 언어",
  fieldTheme: "테마",
  toggleCursorBlink: "커서 깜박임",
  toggleTranscription: "음성 전사",
  btnSave: "저장",
  savedNote: "저장됨 ✓",
  versionPrefix: "버전",
  langAuto: "자동 감지",
  themeLight: "라이트",
  themeDark: "다크",
  themeTerminal: "터미널",
  message: {
    noApiKey: "설정을 열고 OpenAI API 키를 설정하면 음성 전사가 시작됩니다。",
  },
};

export const TRANSLATIONS: Record<Locale, Translations> = { en, ja, zh, zt, ko };
