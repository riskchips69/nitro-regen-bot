const fetchGift = async (token) => {
    try {
        const response = await fetch('https://discord.com/api/v9/users/@me/entitlements/gifts', {
            headers: {
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9',
                'authorization': token,
                'referer': 'https://discord.com/channels/@me',
                'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                'x-debug-options': 'bugReporterEnabled',
                'x-discord-locale': 'en-US',
                'x-discord-timezone': 'Asia/Calcutta',
            }
        });

        if (!response.ok) return { error: true, status: response.status };

        const data = await response.json();
        
        const grouped = {};

        data.forEach(gift => {
            const key = `${gift.sku_id}-${gift.application_id}-${gift.consumed}-${gift.subscription_plan.id}-${gift.type}-${gift.subscription_plan.name}`;
            
            if (!grouped[key]) {
                grouped[key] = {
                    sku_id: gift.sku_id,
                    application_id: gift.application_id,
                    consumed: gift.consumed,
                    subscription_plan_id: gift.subscription_plan.id,
                    gift_type: gift.gift_style,
                    name: gift.subscription_plan.name,
                    quantity: 1,
                    codes: []
                };
            } else {
                grouped[key].quantity += 1;
            }
        });

        for (const key in grouped) {
            const { sku_id, subscription_plan_id } = grouped[key];

            const codeResponse = await fetch(`https://discord.com/api/v9/users/@me/entitlements/gift-codes?sku_id=${sku_id}&subscription_plan_id=${subscription_plan_id}`, {
                headers: {
                    'accept': '*/*',
                    'accept-language': 'en-US,en;q=0.9',
                    'authorization': token,
                    'referer': 'https://discord.com/channels/@me',
                    'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                    'x-debug-options': 'bugReporterEnabled',
                    'x-discord-locale': 'en-US',
                    'x-discord-timezone': 'Asia/Calcutta'
                }
            });

            if (!codeResponse.ok) continue;

            const codeData = await codeResponse.json();

            if (Array.isArray(codeData)) {
                grouped[key].codes = codeData.map(c => c.code);
            }
        }

        return Object.values(grouped);
    } catch (error) {
        return { error: true, message: error.message };
    }
};

module.exports = fetchGift;
