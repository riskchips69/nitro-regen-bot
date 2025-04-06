const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = path.join(process.cwd(), "config.json");
const fetchGift = require('./src/skudetails');
const generateGiftCodes = require('./src/generate')
const deleteGiftCodes = require('./src/delete')

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const rest = new REST({ version: '10' }).setToken(config.bot.token);
const TOKEN_FILE = path.join(process.cwd(), 'token.json');

const commands = [
    {
        name: 'add-token',
        description: 'Adds or replaces a token',
        options: [
            {
                name: 'token',
                type: 3,
                description: 'The token to add',
                required: true
            }
        ]
    },
    {
        name: 'token-inv-info',
        description: 'Fetches token inventory details'
    },
    {
        name: 'find-generated-codes',
        description: 'Fetches all generated gift codes and sends them in a file.'
    },
    {
        name: 'delete-codes',
        description: 'Fetches all the codes and sends them for delete.'
    },
    
    {
        name: 'delete-custom-link',
        description: 'Deletes custom code.'
    },
    
    {
        name: 'regen-code',
        description: 'Regens all the code.'
    },
    
    {
        name: 'regen-custom-link',
        description: 'Regens custom codes.'
    }
];

client.once('ready', async () => {
    try {
        const clientId = config.bot.client_id;
        await rest.put(Routes.applicationCommands(clientId), { body: commands });
        console.clear()
        console.log('Commands registered');
    } catch (error) {
        console.error(error);
    }
});








client.on('interactionCreate', async interaction => {
    try{
    if (!interaction.isCommand() && !interaction.isModalSubmit()) return;

    if (interaction.commandName === 'regen-custom-link') {
        if (!config.auth.owner.includes(interaction.user.id)) {
            return interaction.reply({ content: 'Only owners can use this command.', ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId('regenCustomLinkModal')
            .setTitle('Enter Gift Links');

        const inputField = new TextInputBuilder()
            .setCustomId('giftCodes')
            .setLabel('Enter gift links')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(4000);

        modal.addComponents(new ActionRowBuilder().addComponents(inputField));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'regenCustomLinkModal') {
        await interaction.deferReply({ ephemeral: true });
        try {
            let tokensData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'token.json'), 'utf-8'));
            let token = tokensData.token;

            let input = interaction.fields.getTextInputValue('giftCodes')
                .split(/\r?\n/)
                .map(line => line.trim().split('gift/')[1])
                .filter(Boolean);

            if (input.length === 0) {
                return await interaction.editReply({ content: 'Invalid format: No valid gift codes found.', ephemeral: true });
            }

            let allGifts = await fetchGift(token);
            let groupedCodes = {};

            for (let code of input) {
                let match = allGifts.find(g => g.codes.includes(code));
                if (match) {
                    let key = `${match.sku_id}_${match.subscription_plan_id}_${match.gift_type}`;
                    if (!groupedCodes[key]) {
                        groupedCodes[key] = { sku_id: match.sku_id, subscription_plan_id: match.subscription_plan_id, gift_type: match.gift_type, codes: [] };
                    }
                    groupedCodes[key].codes.push(code);
                }
            }

            if (Object.keys(groupedCodes).length === 0) {
                return await interaction.editReply({ content: 'Invalid format: No matching codes found.', ephemeral: true });
            }

            for (let key in groupedCodes) {
                await deleteGiftCodes(token, groupedCodes[key].codes);
                let generatedResponse = await generateGiftCodes(
                    token,
                    groupedCodes[key].sku_id,
                    groupedCodes[key].subscription_plan_id,
                    groupedCodes[key].gift_type,
                    groupedCodes[key].codes.length
                );
                groupedCodes[key].codes = generatedResponse.codes;
            }

            let output = Object.values(groupedCodes)
                .flatMap(g => g.codes && Array.isArray(g.codes) ? g.codes.map(c => `https://discord.gift/${c}`) : [])
                .join('\n');

            let filePath = path.join(__dirname, 'regenerated.txt');
            fs.writeFileSync(filePath, output);

            let file = new AttachmentBuilder(filePath);
            await interaction.user.send({ content: 'Here are your regenerated gift links:', files: [file] });
            fs.unlinkSync(filePath);

            await interaction.editReply({ content: 'Regenerated links have been sent to your DMs.', ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'An error occurred while processing your request.', ephemeral: true });
        }
    }
}catch(error){
    console.log(error)
}
});

client.on('interactionCreate', async interaction => {
    try{
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'regen-code') {
        if (!config.auth.owner.includes(interaction.user.id)) {
            return interaction.reply({ content: 'Unauthorized', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        if (!fs.existsSync(TOKEN_FILE)) {
            return interaction.editReply('No token saved. Please add a token first.');
        }

        const { token } = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));

        try {
            const gifts = await fetchGift(token);
            if (!gifts.length) return interaction.editReply('No gifts found.');

            const buttons = gifts.map(gift => 
                new ButtonBuilder()
                    .setCustomId(`regen_${gift.sku_id}_${gift.subscription_plan_id}_${gift.gift_style}`)
                    .setLabel(`Regen ${gift.name} (${gift.quantity})`)
                    .setStyle(ButtonStyle.Secondary)
            );

            const actionRow = new ActionRowBuilder().addComponents(buttons);

            const embed = new EmbedBuilder()
                .setTitle('🎁 Regenerate Gift Codes')
                .setDescription('Select a gift to regenerate from the buttons below.')
                .setColor(0x00ff00) 
                .setFooter({ text: 'Regen Bot', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], components: [actionRow] });

        } catch (error) {
            await interaction.editReply(`Error: ${error.message}`);
        }
    }
}catch(error){
    console.log(error)
}
});

client.on('interactionCreate', async interaction => {
    try{
    if (!interaction.isChatInputCommand()) return;
    
    if (interaction.commandName === 'delete-custom-link') {
        if (!config.auth.owner.includes(interaction.user.id)) {
            return interaction.reply({ content: 'Unauthorized', ephemeral: true });
        }
        
        const modal = new ModalBuilder()
            .setCustomId('delete_custom_link_modal')
            .setTitle('Delete Custom Gift Links');
        
        const input = new TextInputBuilder()
            .setCustomId('gift_links')
            .setLabel('Enter Gift Links')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(4000)
            .setPlaceholder('Enter one gift link or code per line');
        
        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);
        
        await interaction.showModal(modal);
    }
}catch(error){
    console.log(error)
}
});



client.on('interactionCreate', async interaction => {
    try{
    if (!interaction.isButton()) return;
    
    if (interaction.customId.startsWith('regen_')) {
        if (!config.auth.owner.includes(interaction.user.id)) {
            return interaction.reply({ content: 'Unauthorized', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        
        const [_, sku_id, subscription_plan_id, gift_style] = interaction.customId.split('_');
        
        if (!fs.existsSync(TOKEN_FILE)) {
            return interaction.editReply('No token saved. Please add a token first.');
        }

        const { token } = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));

        try {
            const gifts = await fetchGift(token);
            const matchedGift = gifts.find(g => g.sku_id === sku_id && g.subscription_plan_id === subscription_plan_id);
            
            if (!matchedGift) {
                return interaction.editReply('Invalid SKU ID or Subscription Plan ID.');
            }
            
            await deleteGiftCodes(token, matchedGift.codes);
            
            const { codes, errors } = await generateGiftCodes(token, sku_id, subscription_plan_id, matchedGift.gift_type, matchedGift.quantity);
            
            const fileContent = codes.map(code => `https://discord.gift/${code}`).join('\n');
            const filePath = `./regenerated.txt`;
            fs.writeFileSync(filePath, fileContent);
            
            await interaction.user.send({ files: [filePath] });
            fs.unlinkSync(filePath);

            await interaction.editReply('Regenerated codes have been sent to your DM.');
        } catch (error) {
            await interaction.editReply(`Error: ${error.message}`);
        }
    }
}catch(error){
    console.log(error)
}
});


client.on('interactionCreate', async interaction => {
    try{
    if (!interaction.isModalSubmit()) return;
    
    if (interaction.customId === 'delete_custom_link_modal') {
        if (!fs.existsSync(TOKEN_FILE)) {
            return interaction.reply({ content: 'No token saved. Please add a token first.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        const { token } = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
        const inputText = interaction.fields.getTextInputValue('gift_links');
        
        const codes = [...new Set(inputText.match(/(?:https?:\/\/)?discord\.gift\/([a-zA-Z0-9]+)/g)?.map(m => m.split('/').pop()) || [])];
        
        if (!codes.length) return interaction.editReply('No valid gift codes found.\n\nformat :\n\n\`\`\`\nhttps://discord.gift/<code1>\nhttps://discord.gift/<code2>\`\`\`');
        
        try {
            const results = await deleteGiftCodes(token, codes);
            const filePath = path.join(__dirname, `deleted_codes.txt`);
            const content = Object.entries(results).map(([code, { code: status }]) => `${code} -----> ${status}`).join('\n');
            fs.writeFileSync(filePath, content);
            
            const attachment = new AttachmentBuilder(filePath);
            await interaction.user.send({ files: [attachment] });
            fs.unlinkSync(filePath);
            
            await interaction.editReply('Deleted gift codes. Check your DM for details.');
        } catch (error) {
            await interaction.editReply(`Error: ${error.message}`);
        }
    }
}catch(error){
    console.log(error)
}
});


client.on('interactionCreate', async interaction => {
    try{
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'add-token') {
        if (!config.auth.owner.includes(interaction.user.id)) {
            return interaction.reply({ content: 'Unauthorized', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        const token = interaction.options.getString('token');
        fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token }, null, 2));
        await interaction.followUp('Token added');
    }

    if (interaction.commandName === 'token-inv-info') {
        if (!config.auth.owner.includes(interaction.user.id)) {
            return interaction.reply({ content: 'Unauthorized', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        
        const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
        const token = tokenData.token;
        
        try {
            const inventory = await fetchGift(token);
            
            if (!inventory.length) {
                return interaction.followUp({ content: 'No gift inventory found.', ephemeral: true });
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🎁 Token Inventory Information')
                .setColor('#5865F2')
                .setTimestamp();
            
            inventory.forEach(gift => {
                const generatedCodes = gift.codes.length;
                const ungenerated = gift.quantity - generatedCodes;
                embed.addFields({
                    name: `${gift.name} (SKU: ${gift.sku_id})`,
                    value: `**Quantity:** ${gift.quantity}\n**Generated Codes:** ${generatedCodes}\n**Ungenerated:** ${ungenerated}`,
                    inline: false
                });
            });
            
            await interaction.followUp({ embeds: [embed], ephemeral: true });
        } catch (error) {
            await interaction.followUp({ content: `Error fetching inventory: ${error.message}`, ephemeral: true });
        }
    }
}catch(error){
    console.log(error)
}
});

client.on('interactionCreate', async interaction => {
    try{
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('delete_')) {
        if (!config.auth.owner.includes(interaction.user.id)) {
            return interaction.reply({ content: 'Unauthorized', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const [, skuId, appId] = interaction.customId.split('_');

        if (!fs.existsSync(TOKEN_FILE)) {
            return interaction.editReply('No token saved. Please add a token first.');
        }

        const { token } = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));

        try {
            const gifts = await fetchGift(token);
            const gift = gifts.find(g => g.sku_id === skuId && g.subscription_plan_id === appId);

            if (!gift) return interaction.editReply('Invalid SKU ID and subscription_plan_id ID.');

            if (!gift.codes.length) return interaction.editReply('No codes found for this gift.');

            const results = await deleteGiftCodes(token, gift.codes);
            const filePath = path.join(__dirname, `delete_results.txt`);
            const fileContent = Object.entries(results).map(([code, { code: success }]) => `${code} ----> ${success}`).join('\n');

            fs.writeFileSync(filePath, fileContent);

            const user = await client.users.fetch(interaction.user.id);
            const attachment = new AttachmentBuilder(filePath);
            await user.send({ files: [attachment] });

            fs.unlinkSync(filePath);
            await interaction.editReply('Deletion complete. Results sent to your DM.');
        } catch (error) {
            await interaction.editReply(`Error: ${error.message}`);
        }
    }
}catch(error){
    console.log(error)
}
});

client.on('interactionCreate', async interaction => {
    try{
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'find-generated-codes') {
        if (!config.auth.owner.includes(interaction.user.id)) {
            return interaction.reply({ content: 'Unauthorized', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        if (!fs.existsSync(TOKEN_FILE)) {
            return interaction.editReply('No token saved. Please add a token first.');
        }

        const { token } = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));

        try {
            const gifts = await fetchGift(token);
            if (!gifts.length) return interaction.editReply('No gifts found.');

            const filePaths = [];
            for (const gift of gifts) {
                if (gift.codes.length === 0) continue;

                const formattedCodes = gift.codes.map(code => `https://discord.gift/${code}`).join('\n');
                

               
fileName = gift.name.toLowerCase().replace(/\s+/g, "-")

const filePath = path.join(process.cwd(), fileName);
                
                fs.writeFileSync(filePath, formattedCodes);
                filePaths.push(filePath);
            }

            if (!filePaths.length) return interaction.editReply('No generated codes found.');

            const user = await client.users.fetch(interaction.user.id);
            const attachments = filePaths.map(filePath => new AttachmentBuilder(filePath));

            await user.send({ content: 'Here are your generated codes:', files: attachments });

            filePaths.forEach(filePath => fs.unlinkSync(filePath));

            await interaction.editReply('Gift codes sent successfully!');
        } catch (error) {
            await interaction.editReply(`Error: ${error.message}`);
        }
    }
}catch(error){
    console.log(error)
}
});

client.on('interactionCreate', async interaction => {
    try{
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'delete-codes') {
        if (!config.auth.owner.includes(interaction.user.id)) {
            return interaction.reply({ content: 'Unauthorized', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        if (!fs.existsSync(TOKEN_FILE)) {
            return interaction.editReply('No token saved. Please add a token first.');
        }

        const { token } = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));

        try {
            const gifts = await fetchGift(token);
            if (!gifts.length) return interaction.editReply('No generated codes found.');

            const buttons = [];
            for (const gift of gifts) {
                if (gift.codes.length === 0) continue;

                const button = new ButtonBuilder()
                    .setCustomId(`delete_${gift.sku_id}_${gift.subscription_plan_id}`)
                    .setLabel(`Delete ${gift.name} (${gift.codes.length})`)
                    .setStyle(ButtonStyle.Danger);

                buttons.push(button);
            }

            if (!buttons.length) return interaction.editReply('No generated codes found.');

            const embed = new EmbedBuilder()
                .setTitle('Delete Generated Codes')
                .setDescription('Found these codes. Click on the button to delete the codes.')
                .setColor('Red');

            const row = new ActionRowBuilder().addComponents(buttons);
            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            await interaction.editReply(`Error: ${error.message}`);
        }
    }
}catch(error){
    console.log(error)
}
});

client.login(config.bot.token);
