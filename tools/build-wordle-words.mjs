// Builds server/GameServer/GameData/wordle-words.json.
// Answers are a hand-picked list of common words; allowed guesses add the public-domain
// Webster's 2nd (web2) dictionary shipped with macOS/BSD plus simple plurals/past tenses.
import fs from 'node:fs';
import path from 'node:path';

const answers = `
apple beach brain bread brick bring brush candy chair chalk charm cheap check chess chest chief child
clean clear climb clock cloud coast couch count cover crane cream crowd crown dance delta dream dress
drink drive eagle earth empty enjoy equal event extra faith fancy feast field final flame flash fleet
float flour fluid focus force forty frame fresh front frost fruit ghost giant glass globe glove grace
grade grain grand grape grass great green group guard guess guest guide happy heart heavy hello honey
horse hotel house human humor ideal image index input jelly jewel joint juice knife label large laser
laugh layer lemon level light limit lucky lunch magic major maple march match metal minor model money
month motor mouse mouth movie music nerve never night noble noise north novel ocean olive opera orbit
order other otter paint panel paper party pasta peace peach pearl phone photo piano pilot pizza place
plain plane plant plate point power press price pride prime print prize proud queen quick quiet radio
raise range rapid reach ready river robot rocky round royal ruler salad sauce scale scene score shape
share sharp sheep shelf shell shine shirt shock shore short sight skill sleep slice smart smile smoke
snack snake solid sound south space spark spice spoon sport squad stack stage stamp stand start steam
steel stick stone storm story stove sugar sunny super sweet swift table taste teach thick thing think
tiger toast token tooth topic torch total tower track trade train treat trend trick truck trust truth
twist uncle under union urban value video visit vital voice water whale wheat wheel white whole world
worry write young youth zebra blaze bloom crisp dwarf fairy flint gecko haste ivory jolly karma
lunar mango medal nacho ninja oasis panda pixel quest raven scarf spine sword thorn tulip vapor waltz
wagon yacht acorn badge baker cabin camel cargo cider comet coral daisy dough elbow fable ferry flock
forge gravy hatch hippo igloo koala ladle llama lotus mocha moose nudge onion patio plume quilt rhyme
`.split(/\s+/).filter(Boolean);

const web2 = fs.existsSync('/usr/share/dict/web2') ? fs.readFileSync('/usr/share/dict/web2', 'utf8').split('\n') : [];
const allowed = new Set(answers);
for (const w of web2) {
  if (/^[a-z]{5}$/.test(w)) allowed.add(w);
  if (/^[a-z]{4}$/.test(w) && !w.endsWith('s')) allowed.add(w + 's');
  if (/^[a-z]{4}$/.test(w) && w.endsWith('e')) allowed.add(w + 'd');
  if (/^[a-z]{3}$/.test(w)) { allowed.add(w + 'ed'); allowed.add(w + 'es'); }
}
const bad = answers.filter((w) => !/^[a-z]{5}$/.test(w));
if (bad.length) throw new Error('Invalid answers: ' + bad.join(', '));

const out = { answers: [...new Set(answers)].sort(), allowed: [...allowed].filter((w) => !answers.includes(w)).sort() };
const target = path.resolve(import.meta.dirname, '../server/GameServer/GameData/wordle-words.json');
fs.writeFileSync(target, JSON.stringify(out));
console.log(`answers=${out.answers.length} allowed=${out.allowed.length + out.answers.length}`);
