// ============================================================
// НАСТРОЙКА ПОДКЛЮЧЕНИЯ К SUPABASE
// ============================================================
// Возьмите эти два значения в вашем проекте Supabase:
//   Project Settings → API → Project URL
//   Project Settings → API → Project API keys → anon / public
//
// Это ПУБЛИЧНЫЕ значения — их видно в исходном коде страницы,
// это нормально и безопасно: доступ к данным контролируется
// правилами Row Level Security на стороне базы (см. schema.sql),
// а не секретностью этого ключа.
// ============================================================

const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
const SUPABASE_CONFIGURED =
  !!SUPABASE_URL &&
  !!SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes("YOUR-PROJECT-REF") &&
  !SUPABASE_ANON_KEY.includes("YOUR-ANON-PUBLIC-KEY");

// Общий клиент для script.js и admin.js.
// Если значения не заполнены, проект автоматически работает в демо-режиме
// на локальном хранилище, чтобы страница не падала в браузере.
const sb = SUPABASE_CONFIGURED && window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
