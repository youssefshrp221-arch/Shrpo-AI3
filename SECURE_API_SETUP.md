# 🔐 نظام API آمن - Shrpo AI

## نظرة عامة

تم تحديث Shrpo AI ليعمل مع نظام API آمن حيث يتم حماية NVIDIA API key في الـ Backend ولا يظهر أبداً للمستخدمين النهائيين.

## البنية الأمنية

### 1. Server-Side API Key Storage (الـ Backend)
- يتم حفظ `NVIDIA_API_KEY` في متغيرات البيئة على الـ Server فقط
- لا يتم أبداً إرساله للـ Frontend
- لا يتم حفظه في localStorage أو Session Storage

### 2. Secure Proxy Route
- **المسار**: `/api/chat` (Backend API Route)
- المستخدمون يرسلون requests إلى هذا الـ Proxy بدون API key
- الـ Backend يضيف API key الخاص به تلقائياً
- الـ Backend يتحقق من صلاحية الـ Model والـ Parameters

### 3. Frontend - Zero API Key Exposure
- لا يوجد مدخل لإدخال API key في الـ Frontend
- تم حذف شاشة `ApiKeyScreen` من الـ Flow الرئيسي
- جميع الطلبات تذهب للـ Backend Proxy

## الملفات المحدثة

### Backend:
- **`route.ts`** - Backend API Proxy
  - يتعامل مع `/api/chat` POST requests
  - يتحقق من صلاحية النماذج
  - يضيف API key من `process.env.NVIDIA_API_KEY`
  - يعيد الـ Response للـ Frontend

### Frontend:
- **`nvidia.ts`** - Client NVIDIA Integration
  - `streamChat()` - يرسل requests للـ Backend Proxy بدون API key
  - `chatOnce()` - نفس الشيء للـ Non-streaming requests

- **`modelOrchestrator.ts`** - Model Selection & Fallback
  - إزالة `apiKey` من `StreamOptions` interface
  - جميع الـ Functions تتحرك للـ Backend

- **`appStore.ts`** - Zustand Store
  - إزالة `apiKey` state بالكامل
  - إزالة `setApiKey()` و `clearApiKey()` functions

- **`App.tsx`** - Main App Component
  - إزالة شاشة API Key Gate
  - الآن يعرض `MainLayout` مباشرة

- **`ChatPage.tsx`**, **`WritingStudio.tsx`**, **`NovelStudio.tsx`**, **`ToolsPage.tsx`**
  - إزالة استخدام `apiKey` من جميع الـ Components
  - إزالة `apiKey` parameter من جميع الاستدعاءات

- **`SettingsPage.tsx`**
  - إزالة صفحة تغيير API Key

## كيفية الاستخدام (للمستخدمين)

1. افتح الموقع مباشرة - لا حاجة لإدخال API key
2. استخدم Chat, Writing Studio, Novel Studio, Tools - كل شيء يعمل بدون API key
3. جميع الطلبات تُرسل للـ Backend الآمن

## كيفية النشر (للمطورين)

### 1. Vercel Environment Variables
في لوحة Vercel، أضف متغير البيئة:
```
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Backend Route يكون موجود في:
```
/api/chat    (POST)
```

### 3. Allowed Models (في route.ts)
تأكد من أن النماذج المسموحة محدثة:
```typescript
const allowedModels = [
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.1-70b-instruct',
  'meta/llama-3.1-405b-instruct',
  'nvidia/llama-3.1-nemotron-70b-instruct',
  // ... إلخ
]
```

## الفوائد الأمنية

✅ **API Key محمي** - لا يظهر في الـ Frontend أبداً
✅ **معاملات آمنة** - جميع الاتصالات عبر HTTPS
✅ **التحقق من الصلاحية** - Backend يتحقق من كل request
✅ **قابل للتوسع** - يمكن إضافة rate limiting و authentication في المستقبل
✅ **عدم الثقة بـ Client** - لا نعتمد على أي secret من الـ Client

## مثال على الـ Request

```javascript
// Frontend Request (بدون API key)
fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'meta/llama-3.1-8b-instruct',
    messages: [
      { role: 'user', content: 'مرحبا' }
    ],
    temperature: 0.7,
    stream: true,
  }),
})

// Backend Response
// يضيف API key تلقائياً ويرسل الطلب لـ NVIDIA
// ثم يعيد الـ Response للـ Frontend
```

## الخطوات التالية

- يمكن إضافة Authentication للمستخدمين
- يمكن إضافة Rate Limiting
- يمكن إضافة تتبع الاستخدام
- يمكن إضافة Cost Tracking

---

**Last Updated**: May 13, 2026
**Version**: 1.0
**Security Level**: 🔐 High
