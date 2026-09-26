'use client'

import { useState } from 'react'
import {
  Key,
  Copy,
  Check,
  Code,
  Terminal,
  FileCode,
  Globe,
  Send,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { toast } from 'sonner'
import { maskApiKey } from '@/lib/utils'

interface ProjectItem {
  id: string
  name: string
  appId: string
  apiKey: string
}

interface ApiKeysManagerProps {
  projects: ProjectItem[]
}

export function ApiKeysManager({ projects }: ApiKeysManagerProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id ?? '')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [activeSnippetTab, setActiveSnippetTab] = useState<
    'nodejs' | 'curl' | 'python' | 'php' | 'to-user' | 'list' | 'web-sdk'
  >('nodejs')

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || projects[0]

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(label)
    toast.success(`${label} copied to clipboard!`)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://notify.earnslash.com'
  const apiKey = selectedProject?.apiKey || 'YOUR_REST_API_KEY'
  const appId = selectedProject?.appId || 'YOUR_APP_ID'

  const buildSnippets = (currentKey: string) => ({
    nodejs: `// Broadcast (all users / platform / topic)
const NOTIFY_API_KEY = "${currentKey}";
const NOTIFY_BASE_URL = "${baseUrl}/api/v1";

async function sendPushNotification() {
  const response = await fetch(\`\${NOTIFY_BASE_URL}/notifications\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": \`Bearer \${NOTIFY_API_KEY}\`
    },
    body: JSON.stringify({
      title: "New Story Published!",
      body: "Check out the latest story now.",
      // "all" | "android" | "ios" | "topic:NAME" | "segment:ID"
      target: "all",
      url: "https://example.com/stories/123",
      data: { storyId: "123" }
    })
  });

  const result = await response.json();
  console.log("Notification Result:", result);
}

sendPushNotification();`,

    curl: `curl -X POST "${baseUrl}/api/v1/notifications" \\
  -H "Authorization: Bearer ${currentKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Welcome Offer!",
    "body": "Get 20% discount on your next order.",
    "target": "all"
  }'`,

    python: `import requests

API_KEY = "${currentKey}"
URL = "${baseUrl}/api/v1/notifications"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "title": "New System Update",
    "body": "Version 2.0 is now live for all users.",
    "target": "all"
}

response = requests.post(URL, json=payload, headers=headers)
print("Response:", response.json())`,

    php: `<?php
$apiKey = "${currentKey}";
$url = "${baseUrl}/api/v1/notifications";

$payload = [
    "title"  => "Flash Sale Live!",
    "body"   => "Hurry up, limited time deals available now.",
    "target" => "all"
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer " . $apiKey,
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>`,

    'to-user': `// Send to ONE user by External User ID (all their devices)
// App must call NotifyMVP.setExternalUserId("USER_ID") / login() first.
const NOTIFY_API_KEY = "${currentKey}";
const NOTIFY_BASE_URL = "${baseUrl}/api/v1";

async function sendToUser(externalUserId) {
  const response = await fetch(\`\${NOTIFY_BASE_URL}/notifications\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": \`Bearer \${NOTIFY_API_KEY}\`
    },
    body: JSON.stringify({
      title: "Your order is ready",
      body: "Tap to open your order details.",
      // Option A (OneSignal-style):
      include_external_user_ids: [externalUserId],
      // Option B (same result):
      // target: "user:" + externalUserId,
      url: "https://example.com/orders/123",
      data: { orderId: "123" }
    })
  });

  const result = await response.json();
  console.log(result);
}

sendToUser("firebase_uid_or_your_db_user_id");

/* cURL equivalent:
curl -X POST "${baseUrl}/api/v1/notifications" \\
  -H "Authorization: Bearer ${currentKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Your order is ready",
    "body": "Tap to open your order details.",
    "include_external_user_ids": ["firebase_uid_or_your_db_user_id"]
  }'
*/`,

    list: `// List devices + topics for your custom dashboard
const NOTIFY_API_KEY = "${currentKey}";
const NOTIFY_BASE_URL = "${baseUrl}/api/v1";

async function listDevices() {
  const url = new URL(\`\${NOTIFY_BASE_URL}/devices\`);
  url.searchParams.set("limit", "20"); // page size
  url.searchParams.set("page", "1");   // next page → page=2
  // Optional filters:
  // url.searchParams.set("platform", "android");
  // url.searchParams.set("externalUserId", "USER_ID");
  // url.searchParams.set("country", "IN");
  // url.searchParams.set("status", "subscribed");

  const res = await fetch(url, {
    headers: { "Authorization": \`Bearer \${NOTIFY_API_KEY}\` }
  });
  const data = await res.json();
  console.log(data.page, data.totalPages, data.total, data.devices);
  // each device: platform, deviceModel, appVersion, externalUserId, topics[], lastActive
  // fcmToken is masked (…last8) — never returned in full
}

async function listTopics() {
  const url = new URL(\`\${NOTIFY_BASE_URL}/topics\`);
  // url.searchParams.set("type", "system"); // or "custom"
  // url.searchParams.set("active", "true");

  const res = await fetch(url, {
    headers: { "Authorization": \`Bearer \${NOTIFY_API_KEY}\` }
  });
  const data = await res.json();
  console.log(data.topics);
  // each topic: name, type, description, deviceCount
}

listDevices();
listTopics();

/* cURL:
curl "${baseUrl}/api/v1/devices?limit=20&page=1" \\
  -H "Authorization: Bearer ${currentKey}"

curl "${baseUrl}/api/v1/topics" \\
  -H "Authorization: Bearer ${currentKey}"
*/`,

    'web-sdk': `// Register device + link External User ID (from your app / auth)
fetch("${baseUrl}/api/device/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    appId: "${appId}",
    apiKey: "${currentKey}",
    fcmToken: "USER_FCM_TOKEN",
    platform: "android", // "android" | "ios" | "flutter" | "react-native"
    deviceId: "unique_device_id_123",
    externalUserId: "firebase_uid_or_your_db_user_id" // required for send-to-user
  })
});

// Or from mobile SDK after login:
// Android / RN: NotifyMVP.setExternalUserId("firebase_uid_or_your_db_user_id")
// Flutter:      NotifyMVP.login("firebase_uid_or_your_db_user_id")
// iOS:          await NotifyMVP.setExternalUserId("firebase_uid_or_your_db_user_id")`,
  })

  const realSnippets = buildSnippets(apiKey)
  const displaySnippets = buildSnippets(showApiKey ? apiKey : maskApiKey(apiKey))

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            Create a project first to get your REST API Keys.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Key className="h-6 w-6 text-[var(--primary)]" />
          REST API Keys & SDK Docs
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Use these API credentials to send push notifications from any web application, backend, or script.
        </p>
      </div>

      {/* Project Selector & Keys Card */}
      <Card className="border-[var(--primary)]/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Project API Credentials</span>
            <span className="text-xs font-normal text-[var(--muted-foreground)] flex items-center gap-1">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Secure REST Access
            </span>
          </CardTitle>
          <CardDescription>Select project to view App ID and REST API Key</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Select Project */}
          <div className="max-w-xs space-y-1.5">
            <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase">
              Active Project
            </label>
            <Select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Keys Display */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* App ID */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                <span className="font-semibold uppercase tracking-wider">Project App ID</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(selectedProject?.appId || '', 'App ID')}
                  className="h-7 gap-1 text-xs"
                >
                  {copiedKey === 'App ID' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </>
                  )}
                </Button>
              </div>
              <div className="font-mono text-sm font-bold text-[var(--foreground)] break-all select-all">
                {selectedProject?.appId}
              </div>
            </div>

            {/* REST API Key */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                <span className="font-semibold uppercase tracking-wider">REST API Key</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="h-7 gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    title={showApiKey ? 'Hide API Key' : 'Show API Key'}
                  >
                    {showApiKey ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5" /> Hide
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5" /> Show
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(selectedProject?.apiKey || '', 'API Key')}
                    className="h-7 gap-1 text-xs"
                  >
                    {copiedKey === 'API Key' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <div className="font-mono text-sm font-bold text-[var(--primary)] break-all select-all tracking-wider">
                {showApiKey ? selectedProject?.apiKey : maskApiKey(selectedProject?.apiKey || '')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Code Snippets Section */}
      <Card>
        <CardHeader className="pb-3 border-b border-[var(--border)]">
          <CardTitle className="text-base flex items-center gap-2">
            <Code className="h-4 w-4 text-[var(--primary)]" />
            Send Notification Code Examples
          </CardTitle>
          <CardDescription>
            Copy into your custom dashboard or backend. Broadcast with <code className="text-xs">target: &quot;all&quot;</code>,
            or target one user with <code className="text-xs">include_external_user_ids</code>.
          </CardDescription>

          {/* Snippet Tabs */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              variant={activeSnippetTab === 'nodejs' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSnippetTab('nodejs')}
              className="gap-1.5 text-xs"
            >
              <FileCode className="h-3.5 w-3.5" /> Node.js / JS
            </Button>

            <Button
              variant={activeSnippetTab === 'curl' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSnippetTab('curl')}
              className="gap-1.5 text-xs"
            >
              <Terminal className="h-3.5 w-3.5" /> cURL
            </Button>

            <Button
              variant={activeSnippetTab === 'python' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSnippetTab('python')}
              className="gap-1.5 text-xs"
            >
              <Code className="h-3.5 w-3.5" /> Python
            </Button>

            <Button
              variant={activeSnippetTab === 'php' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSnippetTab('php')}
              className="gap-1.5 text-xs"
            >
              <Code className="h-3.5 w-3.5" /> PHP
            </Button>

            <Button
              variant={activeSnippetTab === 'to-user' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSnippetTab('to-user')}
              className="gap-1.5 text-xs"
            >
              <Send className="h-3.5 w-3.5" /> External User ID
            </Button>

            <Button
              variant={activeSnippetTab === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSnippetTab('list')}
              className="gap-1.5 text-xs"
            >
              <Globe className="h-3.5 w-3.5" /> Devices & Topics
            </Button>

            <Button
              variant={activeSnippetTab === 'web-sdk' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSnippetTab('web-sdk')}
              className="gap-1.5 text-xs"
            >
              <Globe className="h-3.5 w-3.5" /> Device SDK Register
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(realSnippets[activeSnippetTab], 'Code snippet')}
              className="absolute right-3 top-3 z-10 gap-1.5 text-xs bg-[var(--card)]"
            >
              {copiedKey === 'Code snippet' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy Code
                </>
              )}
            </Button>

            <pre className="overflow-x-auto rounded-lg bg-[var(--muted)] p-4 text-xs font-mono text-[var(--foreground)] leading-relaxed border border-[var(--border)]">
              <code>{displaySnippets[activeSnippetTab]}</code>
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
