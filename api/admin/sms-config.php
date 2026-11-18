<?php
// VIDHYAA Jewellery Studio - Admin SMS Configuration & Diagnostic Endpoint (Hostinger Production)
require_once __DIR__ . '/_auth.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, x-admin-token');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

vdhRequireAdmin();

function vdhReadSmsConfigSafe(): array {
    $cfg = [];
    $cand = vdhOutsideSecretsFilePath('sms-config.json');
    if ($cand !== null && vdhIsPathPermittedByOpenBasedir($cand) && @is_file($cand) && @is_readable($cand)) {
        $parsed = json_decode((string)@file_get_contents($cand), true);
        if (is_array($parsed)) {
            $cfg = $parsed;
        }
    }

    $fast2sms = trim((string)($cfg['fast2smsApiKey'] ?? vdhEnv('FAST2SMS_API_KEY')));
    $twofactor = trim((string)($cfg['twofactorApiKey'] ?? vdhEnv('TWOFACTOR_API_KEY')));
    $msg91Key = trim((string)($cfg['msg91AuthKey'] ?? vdhEnv('MSG91_AUTH_KEY')));
    $msg91Tpl = trim((string)($cfg['msg91TemplateId'] ?? vdhEnv('MSG91_TEMPLATE_ID')));
    $twilioSid = trim((string)($cfg['twilioAccountSid'] ?? vdhEnv('TWILIO_ACCOUNT_SID')));
    $twilioTok = trim((string)($cfg['twilioAuthToken'] ?? vdhEnv('TWILIO_AUTH_TOKEN')));
    $twilioNum = trim((string)($cfg['twilioPhoneNumber'] ?? vdhEnv('TWILIO_PHONE_NUMBER')));

    $isFast2Sms = strlen($fast2sms) > 5;
    $isTwoFactor = strlen($twofactor) > 5;
    $isTwilio = ($twilioSid !== '' && $twilioTok !== '' && $twilioNum !== '');
    $isMsg91 = ($msg91Key !== '' && $msg91Tpl !== '');

    $activeProvider = 'None Configured (Setup Required)';
    if ($isTwilio) $activeProvider = 'Twilio Worldwide SMS';
    elseif ($isFast2Sms) $activeProvider = 'Fast2SMS India';
    elseif ($isTwoFactor) $activeProvider = '2Factor.in India';
    elseif ($isMsg91) $activeProvider = 'MSG91 Enterprise';

    $maskedTwilio = '';
    if ($twilioNum !== '') {
        $maskedTwilio = strlen($twilioNum) > 5
            ? substr($twilioNum, 0, 3) . '••••' . substr($twilioNum, -2)
            : '••••';
    }

    return [
        'raw' => [
            'provider' => (string)($cfg['provider'] ?? vdhEnv('SMS_PROVIDER', 'auto')),
            'fast2smsApiKey' => $fast2sms,
            'twofactorApiKey' => $twofactor,
            'msg91AuthKey' => $msg91Key,
            'msg91TemplateId' => $msg91Tpl,
            'twilioAccountSid' => $twilioSid,
            'twilioAuthToken' => $twilioTok,
            'twilioPhoneNumber' => $twilioNum,
        ],
        'summary' => [
            'success' => true,
            'configured' => ($isFast2Sms || $isTwoFactor || $isTwilio || $isMsg91),
            'activeProvider' => $activeProvider,
            'internationalSupported' => $isTwilio,
            'storedOutsideWebroot' => ($cand !== null && @is_file($cand)),
            'providers' => [
                'twilio' => [
                    'configured' => $isTwilio,
                    'description' => 'Worldwide international SMS delivery (180+ countries)',
                    'senderNumber' => $maskedTwilio,
                ],
                'fast2sms' => [
                    'configured' => $isFast2Sms,
                    'description' => 'Indian OTP delivery gateway',
                ],
                'twofactor' => [
                    'configured' => $isTwoFactor,
                    'description' => 'Indian OTP fallback gateway',
                ],
                'msg91' => [
                    'configured' => $isMsg91,
                    'description' => 'Enterprise OTP gateway',
                ],
            ],
        ],
    ];
}

$action = trim((string)($_GET['action'] ?? ''));
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($action === 'test' && $method === 'POST') {
    $cfg = vdhReadSmsConfigSafe()['raw'];
    $body = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($body)) $body = [];
    $mobile = trim((string)($body['phoneNumber'] ?? ($body['mobile'] ?? '')));
    if ($mobile === '' || strlen($mobile) < 8) {
        vdhSendJson(400, ['success' => false, 'error' => 'Valid mobile number required.']);
    }

    $hasGateway = (
        $cfg['fast2smsApiKey'] !== '' ||
        $cfg['twofactorApiKey'] !== '' ||
        ($cfg['twilioAccountSid'] !== '' && $cfg['twilioAuthToken'] !== '' && $cfg['twilioPhoneNumber'] !== '')
    );

    if (!$hasGateway) {
        vdhSendJson(400, [
            'success' => false,
            'provider' => 'none',
            'error' => 'No SMS gateway credentials configured on server. Mobile customer login uses native Passwordless/Password authentication cleanly without paid SMS charges.'
        ]);
    }

    $provider = ($cfg['twilioAccountSid'] !== '' && $cfg['twilioAuthToken'] !== '' && $cfg['twilioPhoneNumber'] !== '')
        ? 'twilio'
        : ($cfg['fast2smsApiKey'] !== '' ? 'fast2sms' : 'twofactor');

    vdhSendJson(200, [
        'success' => true,
        'provider' => $provider,
        'phoneNumber' => $mobile,
        'message' => 'SMS gateway credentials validated locally (no external paid message dispatched).'
    ]);
}

if ($method === 'GET') {
    vdhSendJson(200, vdhReadSmsConfigSafe()['summary']);
}

if ($method === 'POST') {
    $body = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($body)) {
        vdhSendJson(400, ['success' => false, 'error' => 'Invalid SMS config payload.']);
    }

    $outsideDir = vdhOutsideSecretsDir();
    if ($outsideDir === null) {
        vdhSendJson(500, [
            'success' => false,
            'error' => 'Cannot access outside-webroot .admin-secrets directory (open_basedir or permissions restriction). Refusing insecure webroot secrets write.'
        ]);
    }

    $current = vdhReadSmsConfigSafe()['raw'];
    $fields = [
        'fast2smsApiKey',
        'twofactorApiKey',
        'msg91AuthKey',
        'msg91TemplateId',
        'twilioAccountSid',
        'twilioAuthToken',
        'twilioPhoneNumber',
    ];
    foreach ($fields as $f) {
        if (array_key_exists($f, $body) && $body[$f] !== null) {
            $current[$f] = trim((string)$body[$f]);
        }
    }
    $current['updatedAt'] = gmdate('Y-m-d\TH:i:s.000\Z');

    $targetPath = $outsideDir . '/sms-config.json';
    if (!vdhIsPathPermittedByOpenBasedir($targetPath) || !vdhAtomicWriteFile($targetPath, (string)json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES))) {
        vdhSendJson(500, [
            'success' => false,
            'error' => 'Failed to store SMS configuration outside webroot.'
        ]);
    }
    @chmod($targetPath, 0600);
    vdhSendJson(200, vdhReadSmsConfigSafe()['summary']);
}

vdhSendJson(405, ['success' => false, 'error' => 'Method not allowed.']);
