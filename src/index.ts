import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const commands = [
  new SlashCommandBuilder()
    .setName('atis')
    .setDescription('Retrieves ATIS information for an airport')
    .addStringOption(option =>
      option.setName('airport')
        .setDescription('ICAO code of the airport (e.g. EDDF)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('arr_rwy')
        .setDescription('Arrival Runway (e.g. 25C)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('dep_rwy')
        .setDescription('Departure Runway (e.g. 25C)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('atis_code')
        .setDescription('ATIS Code Letter (e.g. A)')
        .setRequired(true)
    )
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

async function registerCommands() {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!),
      { body: commands }
    );
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

async function fetchMetar(airport: string): Promise<string> {
  try {
    const response = await fetch(`https://metar.vatsim.net/${airport}`);
    const metar = await response.text();
    return metar.trim() || 'METAR not available';
  } catch (error) {
    console.error('Error fetching METAR:', error);
    return 'METAR not available';
  }
}

client.once('ready', () => {
  console.log(`Bot is logged in as ${client.user?.tag}`);
  registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'atis') {
    await handleAtisCommand(interaction);
  }
});

async function handleAtisCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const airport = interaction.options.getString('airport')!.toUpperCase();
  const arrRwy = interaction.options.getString('arr_rwy')!;
  const depRwy = interaction.options.getString('dep_rwy')!;
  const atisCode = interaction.options.getString('atis_code')!.toUpperCase();

  try {
    const metar = await fetchMetar(airport);
    const encodedMetar = encodeURIComponent(metar);

    const atisUrl = `http://uniatis.net/atis.php?arr=${arrRwy}(${airport})&dep=${depRwy}(${airport})&apptype=ILS&info=${atisCode}&metar=${encodedMetar}`;

    const response = await fetch(atisUrl);
    const atisText = await response.text();

    const embed = new EmbedBuilder()
      .setColor(0xFFFFFF)
      .setTitle(`ATIS Information - ${airport}`)
      .setDescription(`\`\`\`${atisText}\`\`\``)
      .addFields(
        { name: 'ATIS Code', value: atisCode, inline: true },
        { name: 'Arrival Runway', value: arrRwy, inline: true },
        { name: 'Departure Runway', value: depRwy, inline: true }
      )
      .setFooter({ text: 'UniATIS Generator' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error fetching ATIS:', error);
    await interaction.editReply({
      content: 'Error fetching ATIS information.'
    });
  }
}

client.login(process.env.DISCORD_TOKEN);