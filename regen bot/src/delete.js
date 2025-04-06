module.exports = async function deleteGiftCodes(token, codes) {
    let results = {};
    for (let code of codes) {
        while (true) {
            let response = await fetch(`https://discord.com/api/v9/users/@me/entitlements/gift-codes/${code}`, {
                method: 'DELETE',
                headers: {
                    'accept': '*/*',
                    'accept-language': 'en-US,en;q=0.9',
                    'authorization': token,
                    'origin': 'https://discord.com',
                    'priority': 'u=1, i',
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
            
            if (response.status === 204) {
                results[code] = { code: true };
                break;
            } else if (response.status === 429) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                results[code] = { error: response.status, deleted: false };
                break;
            }
        }
    }
    return results;
};
