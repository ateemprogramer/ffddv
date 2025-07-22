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
      password: config['bot-account']['password'],
      auth: config['bot-account']['type'],
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version,
   });

   bot.loadPlugin(pathfinder);
   const mcData = require('minecraft-data')(bot.version);
   const defaultMove = new Movements(bot, mcData);
   bot.settings.colorsEnabled = false;
   bot.pathfinder.setMovements(defaultMove);

   bot.once('spawn', () => {
      logger.info("✅ Bot joined the server");

      if (config.utils['auto-auth'].enabled) {
         logger.info('🔐 Starting auto-auth module');
         let password = config.utils['auto-auth'].password;

         setTimeout(() => {
            bot.chat(`/register ${password} ${password}`);
            bot.chat(`/login ${password}`);
         }, 1000);
      }

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
         setTimeout(() => {
            createBot();
         }, config.utils['auto-reconnect-delay']);
      });
   }

   bot.on('kicked', (reason) => {
      let msg = '';
      try {
         const r = JSON.parse(reason);
         msg = r?.text || r?.extra?.[0]?.text || reason;
      } catch {
         msg = reason;
      }
      logger.warn(`🚫 Bot was kicked from server. Reason: ${msg}`);
   });

   bot.on('error', (err) => {
      logger.error(`❌ Error: ${err.message}`);
   });
}

// Bot walking in square pattern (anti-afk)
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


// ✅ Express Web Server to keep Render alive
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('🤖 Bot is alive!'));
app.listen(process.env.PORT || 3000, () => {
   console.log('🌐 Web server running to keep Render alive');
});

