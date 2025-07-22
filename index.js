const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock, GoalXZ } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');
const loggers = require('./logging.js');
const logger = loggers.logger;

function createBot() {
   const bot = mineflayer.createBot({
      username: config['bot-account']['username'],
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version,
      auth: config['bot-account']['type'] // offline o microsoft
   });

   bot.loadPlugin(pathfinder);
   const mcData = require('minecraft-data')(bot.version);
   const defaultMove = new Movements(bot, mcData);
   bot.settings.colorsEnabled = false;
   bot.pathfinder.setMovements(defaultMove);

   bot.once('spawn', () => {
      logger.info("✅ Bot joined the server");

      if (config.utils['chat-messages'].enabled) {
         logger.info('💬 Starting chat-messages module');
         const messages = config.utils['chat-messages']['messages'];
         const delay = config.utils['chat-messages']['repeat-delay'] * 1000;
         let i = 0;

         setInterval(() => {
            bot.chat(messages[i]);
            i = (i + 1) % messages.length;
         }, delay);
      }

      if (config.position.enabled) {
         logger.info(`🧭 Moving to (${config.position.x}, ${config.position.y}, ${config.position.z})`);
         bot.pathfinder.setGoal(new GoalBlock(config.position.x, config.position.y, config.position.z));
      }

      if (config.utils['anti-afk'].enabled) {
         if (config.utils['anti-afk'].sneak) bot.setControlState('sneak', true);
         if (config.utils['anti-afk'].jump) bot.setControlState('jump', true);

         if (config.utils['anti-afk']['hit'].enabled) {
            const delay = config.utils['anti-afk']['hit']['delay'];
            const attackMobs = config.utils['anti-afk']['hit']['attack-mobs'];

            setInterval(() => {
               if (attackMobs) {
                  const entity = bot.nearestEntity(e => e.type !== 'player' && e.type !== 'object');
                  if (entity) return bot.attack(entity);
               }
               bot.swingArm("right", true);
            }, delay);
         }

         if (config.utils['anti-afk'].rotate) {
            setInterval(() => {
               bot.look(bot.entity.yaw + 1, bot.entity.pitch, true);
            }, 5000);
         }

         if (config.utils['anti-afk']['circle-walk'].enabled) {
            circleWalk(bot, config.utils['anti-afk']['circle-walk']['radius']);
         }
      }
   });

   bot.on('chat', (username, message) => {
      if (config.utils['chat-log']) {
         logger.info(`<${username}> ${message}`);
      }
   });

   bot.on('goal_reached', () => {
      if (config.position.enabled) {
         logger.info(`🏁 Bot arrived at target location: ${bot.entity.position}`);
      }
   });

   bot.on('death', () => {
      logger.warn(`☠️ Bot has died. Respawned at: ${bot.entity.position}`);
   });

   if (config.utils['auto-reconnect']) {
      bot.on('end', () => {
         logger.warn('🔁 Bot disconnected. Reconnecting...');
         setTimeout(createBot, config.utils['auto-reconnect-delay']);
      });
   }

   bot.on('kicked', (reason, loggedIn) => {
      let msg = '';
      try {
         const parsed = JSON.parse(reason);
         msg = parsed?.translate || parsed?.text || parsed?.extra?.map(e => e.text).join('') || reason;
      } catch {
         msg = typeof reason === 'string' ? reason : JSON.stringify(reason);
      }

      logger.warn(`🚫 Bot was kicked from server. Reason: ${msg}`);

      if (!loggedIn) {
         logger.error('❗ Bot could not join the server. Check if IP, port or version are correct.');
      }
   });

   bot.on('error', (err) => {
      logger.error(`❌ Connection error: ${err.message}`);
      if (err.code === 'ECONNREFUSED') {
         logger.error('🔌 Connection refused. Is the server online and the IP/port correct?');
      } else if (err.code === 'ENOTFOUND') {
         logger.error('🌐 Could not find server. Check the domain or IP.');
      } else if (err.message.includes('Invalid credentials')) {
         logger.error('🔒 Invalid login. If Mojang, migrate to Microsoft or use "offline" type.');
      } else {
         logger.error(`❗ Unknown error: ${err}`);
      }
   });
}

function circleWalk(bot, radius) {
   const pos = bot.entity.position;
   const x = pos.x;
   const y = pos.y;
   const z = pos.z;

   const points = [
      [x + radius, y, z],
      [x, y, z + radius],
      [x - radius, y, z],
      [x, y, z - radius],
   ];

   let i = 0;
   setInterval(() => {
      if (i === points.length) i = 0;
      bot.pathfinder.setGoal(new GoalXZ(points[i][0], points[i][2]));
      i++;
   }, 3000);
}

createBot();

// 🌐 Web Server para mantener vivo en Render
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('🤖 Bot is alive!'));
app.listen(process.env.PORT || 3000, () => {
   console.log('🌐 Web server running to keep Render alive');

   setTimeout(() => {
  bot.look(Math.random(), Math.random(), true);
  bot.setControlState('sneak', true);
}, Math.random() * 4000 + 1000);

});
