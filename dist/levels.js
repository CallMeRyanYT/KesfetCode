export const WORLDS = [
  { id: 1, icon: '🤖', names: ['The Robot Awakens', 'Robot Uyanıyor'], places: ['KEŞFET Laboratory', 'KEŞFET Laboratuvarı'],
    story: ['KEŞFET LAB has built KAŞİF! “I can move, but I do not know where to go. Can you code my path?” Become KAŞİF’s first coding instructor.', 'KEŞFET LAB, KAŞİF’i geliştirdi! “Hareket edebiliyorum ama nereye gideceğimi bilmiyorum. Yolumu kodlar mısın?” KAŞİF’in ilk kodlama öğretmeni ol.'],
    completion: ['Amazing! Now I can move. But not every path is straight!', 'Harika! Artık hareket edebiliyorum. Ama her yol düz değil!'] },
  { id: 2, icon: '🧩', names: ['Learning Directions', 'Yönleri Öğreniyorum'], places: ['Training Zone', 'Eğitim Alanı'],
    story: ['Choose up, right, down, or left commands to navigate the training zone.', 'Yukarı, sağ, aşağı veya sol komutlarını seçerek eğitim alanında ilerle.'],
    completion: ['Now I can find my way! We are ready for a real adventure!', 'Artık yolumu bulabiliyorum! Gerçek bir maceraya hazırız!'] },
  { id: 3, icon: '🌳', names: ['Discovery Valley', 'Keşif Vadisi'], places: ['Discovery Valley', 'Keşif Vadisi'],
    story: ['The laboratory doors open onto a valley of rocks and hidden crystals. Plan a safe route, then improve it to collect every crystal.', 'Laboratuvar kapıları kayalar ve gizli kristallerle dolu bir vadiye açılıyor. Güvenli bir yol planla, sonra tüm kristalleri toplamak için çözümünü geliştir.'],
    completion: ['Every discovery starts with a plan. Let us power up for the next challenge!', 'Her keşif bir planla başlar. Sıradaki görev için enerji toplayalım!'] },
  { id: 4, icon: '⚡', names: ['Energy Center', 'Enerji Merkezi'], places: ['Energy Center', 'Enerji Merkezi'],
    story: ['Each directional move now uses one energy. Changing direction is free. Batteries refill KAŞİF once per run; crystals are treasures, not fuel.', 'Artık her yön komutu bir enerji harcar. Yön değiştirmek ücretsizdir. Piller her çalıştırmada bir kez KAŞİF’i doldurur; kristaller hazinedir, yakıt değildir.'],
    completion: ['Battery stops and careful routes keep us moving. The robot base is next!', 'Pil durakları ve dikkatli rotalarla ilerliyoruz. Sırada robot üssü var!'] },
  { id: 5, icon: '🏭', names: ['Robot Base', 'Robot Üssü'], places: ['Robot Base', 'Robot Üssü'],
    story: ['Locked doors protect the base. Collect each matching key before entering its door, then combine everything you have learned.', 'Üssü kilitli kapılar koruyor. Her kapıdan önce ona uyan anahtarı topla, sonra öğrendiğin her şeyi birleştir.'],
    completion: ['The base is open! KEŞFET-1 needs its explorer at the launch center.', 'Üs açıldı! KEŞFET-1, kâşifini fırlatma merkezinde bekliyor.'] },
  { id: 6, icon: '🚀', names: ['The KEŞFET-1 Mission', 'KEŞFET-1 Görevi'], places: ['Launch Center', 'Fırlatma Merkezi'],
    story: ['Recover the spacecraft components and the K–Ş–F launch code. Your final algorithm will bring KAŞİF to KEŞFET-1!', 'Uzay aracının parçalarını ve K–Ş–F fırlatma kodunu topla. Son algoritman KAŞİF’i KEŞFET-1’e ulaştıracak!'],
    completion: ['KAŞİF… can you hear me? We need your help… Level 2: Inventor unlocked!', 'KAŞİF… beni duyuyor musun? Yardımına ihtiyacımız var… Seviye 2: Mucit açıldı!'] }
];

// All three age paths stay visible and selectable while the campaign is being
// tested. KAŞİF uses direct compass commands; older paths add turning blocks.
export const CHAPTERS = [
  { id: 1, names: ['Level 1 – EXPLORER', 'Seviye 1 – KAŞİF'], age: ['Ages 4–7', '4–7 yaş'], scope: ['1–30', '1–30'], learning: ['Directions, sequencing, algorithms', 'Yön, sıralama, algoritma'] },
  { id: 2, names: ['Level 2 – INVENTOR', 'Seviye 2 – MUCİT'], age: ['Ages 7–10', '7–10 yaş'], scope: ['1–30', '1–30'], learning: ['Loops, repetition, optimization', 'Döngüler, tekrarlar, optimizasyon'], tools: ['Older path: Forward + Turn blocks', 'Büyük yaş yolu: İleri + Dönüş blokları'] },
  { id: 3, names: ['Level 3 – CODE MASTER', 'Seviye 3 – KOD USTASI'], age: ['Ages 10–12+', '10–12+ yaş'], scope: ['1–30', '1–30'], learning: ['Conditions, sensors, functions', 'Koşullar, sensörler, fonksiyonlar'], tools: ['Older path: Forward + Turn blocks', 'Büyük yaş yolu: İleri + Dönüş blokları'] }
];

// Convert authored routes to direct compass commands used by the player.
function commands(route, heading = 'right', grid = []) {
  const names = { U: 'up', R: 'right', D: 'down', L: 'left' };
  const result = [], collected = new Set();
  let row = grid.findIndex(line => line.includes('S')), col = row < 0 ? 0 : grid[row].indexOf('S');
  const delta = { up: [-1, 0], right: [0, 1], down: [1, 0], left: [0, -1] };
  for (const segment of route.split(' ')) {
    const direction = names[segment[0]];
    for (let index = 0; index < Number(segment.slice(1)); index++) {
      result.push({ type: direction });
      row += delta[direction][0]; col += delta[direction][1];
      const position = `${row},${col}`;
      if (grid[row]?.[col] === 'C' && !collected.has(position)) { result.push({ type: 'collect' }); collected.add(position); }
    }
  }
  return result;
}

function level(id, names, grid, route, objective, extra = {}) {
  const world = Math.ceil(id / 5), solution = commands(route, extra.heading, grid.split('/'));
  if (id === 30) solution.push({ type: 'launch' });
  const readable = language => {
    const labels = language === 0 ? { up: 'Up', right: 'Right', down: 'Down', left: 'Left', collect: 'Collect crystal', press: 'Press button', launch: 'Launch' }
      : { up: 'Yukarı', right: 'Sağ', down: 'Aşağı', left: 'Sol', collect: 'Kristali topla', press: 'Düğmeye bas', launch: 'Fırlat' };
    const groups = [];
    for (const block of solution) {
      if (groups.at(-1)?.type === block.type) groups.at(-1).count++;
      else groups.push({ type: block.type, count: 1 });
    }
    return groups.map(group => `${labels[group.type]}${group.count > 1 ? ` ×${group.count}` : ''}`).join(' → ');
  };
  return { id, world, names, topics: WORLDS[world - 1].names, grid: grid.split('/'), heading: 'right',
    energy: null, objective, hint: [readable(0), readable(1)], solution, target: solution.length, ...extra };
}

export const LEVELS = [
  level(1, ['Wake Up, KAŞİF!', 'Uyan, KAŞİF!'], '#####/#####/#SE##/#####/#####', 'R1',
    ['Choose Right once to reach the charging pad.', 'Şarj alanına ulaşmak için bir kez Sağ seç.']),
  level(2, ['The First Journey', 'İlk Yolculuk'], '#####/#####/#S.E#/#####/#####', 'R2',
    ['Put two Right commands in order.', 'İki Sağ komutunu sıraya koy.']),
  level(3, ['The Long Corridor', 'Uzun Koridor'], '#######/#######/#S...E#/#######/#######', 'R4',
    ['Follow a sequence of four Right commands.', 'Dört Sağ komutundan oluşan bir sıra oluştur.']),
  level(4, ['The Energy Crystal', 'Enerji Kristali'], '#######/#######/#S.C.E#/#######/#######', 'R4',
    ['Drive onto your first crystal, then use Collect crystal before the exit.', 'İlk kristalin üzerine sür, sonra çıkıştan önce Kristali topla bloğunu kullan.']),
  level(5, ['Escape from the Laboratory', 'Laboratuvardan Çıkış'], '#########/#########/#S.C.C.E#/#########/#########', 'R6',
    ['Collect two crystals and complete laboratory training.', 'İki kristali topla ve laboratuvar eğitimini tamamla.']),
  level(6, ['Right Route', 'Sağ Rota'], '#####/#S..#/###.#/###E#/#####', 'R2 D2',
    ['Choose right, then down, to follow the L-shaped route.', 'L şeklindeki rotayı izlemek için sağ ve aşağı komutlarını seç.']),
  level(7, ['Left Route', 'Sol Rota'], '#####/#..E#/#.###/#S###/#####', 'U2 R2',
    ['Choose up, then right, to reach the path above KAŞİF.', 'KAŞİF’in üstündeki yola ulaşmak için yukarı ve sağ komutlarını seç.']),
  level(8, ['Around the Corner', 'Köşeyi Dön'], '#######/#S..###/###.###/###...#/#####.#/#####E#/#######', 'R2 D2 R2 D2',
    ['Combine direct up, right, down, and left commands.', 'Yukarı, sağ, aşağı ve sol komutlarını doğrudan birleştir.']),
  level(9, ['Crystal Path', 'Kristal Yolu'], '#######/#S.C###/###.###/#E.C###/#######', 'R2 D2 L2',
    ['Choose direct directions to reach and collect both crystals.', 'İki kristale ulaşıp toplamak için doğrudan yönleri seç.']),
  level(10, ['Training Course', 'Eğitim Parkuru'], '#######/#S....#/#####.#/#...C.#/#.#####/#....E#/#######', 'R4 D2 L4 D2 R4',
    ['Find your way through the first training maze.', 'İlk eğitim labirentinde yolunu bul.']),
  level(11, ["There’s a Rock in My Way!", 'Yolumda Bir Kaya Var!'], '#######/#S.#.E#/#..#..#/#.....#/#######', 'D2 R4 U2',
    ['Choose directions around the rock that blocks the direct route.', 'Düz yolu kapatan kayanın etrafından yönlerle dolaş.']),
  level(12, ['Two Paths', 'İki Yol'], '#######/#S...##/#.#####/#....E#/#######', 'D2 R4',
    ['Inspect both paths: one ends at a rock wall.', 'İki yolu incele: biri kaya duvarında bitiyor.']),
  level(13, ["Don’t Forget the Crystal", 'Kristali Unutma'], '#######/#S...E#/#.###.#/#..C..#/#######', 'D2 R4 U2',
    ['The exit is nearby, but a perfect mission takes the crystal detour.', 'Çıkış yakında ama kusursuz bir görev için kristalli yoldan dolaş.']),
  level(14, ['Rock Maze', 'Kaya Labirenti'], '#########/#S..#...#/###.#.#.#/#...#.#.#/#.###.#.#/#.....#E#/#########', 'R2 D2 L2 D2 R4 U4 R2 D4',
    ['Plan every corner before running your maze algorithm.', 'Labirent algoritmanı çalıştırmadan önce her köşeyi planla.']),
  level(15, ['The Lost Energy Crystals', 'Kayıp Enerji Kristalleri'], '#########/#SXC....#/###.###.#/#C..#...#/#.###.#.#/#....C.E#/#########', 'R2 D2 L2 D2 R6',
    ['Discover three crystals, and press the route console when you reach it.', 'Üç kristali keşfet ve rotadaki konsola ulaştığında düğmeye bas.']),
  level(16, ["I’m Running Out of Energy!", 'Enerjim Azalıyor!'], '#######/#S....#/#####.#/###E..#/#######', 'R4 D2 L2',
    ['Every directional move costs one energy; changing direction costs nothing.', 'Her yön komutu bir enerji harcar; yön değiştirmek enerji harcamaz.'], { energy: 10 }),
  level(17, ['Charging Station', 'Şarj İstasyonu'], '###########/###########/#S...B..CE#/###########/###########', 'R8',
    ['Reach the battery first: your starting charge cannot reach the crystal.', 'Önce pile ulaş: başlangıç enerjin kristale yetmiyor.'], { energy: 4, batteryRequired: 'goal' }),
  level(18, ['Which Path Is Shorter?', 'Hangi Yol Daha Kısa?'], '#######/#S...E#/#.###.#/#.....#/#######', 'R4',
    ['Choose the short route; the long route needs more than five energy.', 'Kısa yolu seç; uzun yol beşten fazla enerji gerektiriyor.'], { energy: 5 }),
  level(19, ['Crystal or Energy?', 'Kristal mi, Enerji mi?'], '#########/#S.....E#/#.#####.#/#..BC...#/#########', 'D2 R6 U2',
    ['A direct exit earns one star. Find the battery to collect the crystal too.', 'Doğrudan çıkış bir yıldız kazandırır. Kristali de toplamak için pili bul.'], { energy: 6, batteryRequired: 'crystals' }),
  level(20, ['Energy Center', 'Enerji Merkezi'], '###########/#S...B#C.B#/#####.#.#.#/#B..CC#.#.#/#.#####.#.#/#......B#.#/#########.#/#########E#/###########', 'R4 D2 L4 D2 R6 U4 R2 D6',
    ['Plan battery stops through the crystal-filled energy center.', 'Kristallerle dolu enerji merkezinde pil duraklarını planla.'], { energy: 8, batteryRequired: 'goal' }),
  level(21, ['The Locked Door', 'Kilitli Kapı'], '#######/#######/#SK.DE#/#######/#######', 'R4',
    ['Collect the gold key; its door opens when you drive into it.', 'Altın anahtarı topla; kapısına ilerlediğinde kapı açılır.']),
  level(22, ['Find the Key', 'Anahtarı Bul'], '#######/#S.D.E#/#.#####/#K...##/#######', 'D2 U2 R4',
    ['Retrieve the key below you before approaching the locked door.', 'Kilitli kapıya gitmeden önce altındaki anahtarı al.']),
  level(23, ['The Wrong Path', 'Yanlış Yol'], '#########/#S..D..E#/###.###.#/#K..###.#/#######.#/#######.#/#########', 'R2 D2 L2 R2 U2 R4',
    ['The key is in a side corridor. Plan your return to the door.', 'Anahtar yan koridorda. Kapıya geri dönüşünü planla.']),
  level(24, ['Two Keys', 'İki Anahtar'], '#########/#S.KD...#/#######.#/#E.FL...#/#########/#########/#########', 'R6 D2 L6',
    ['Collect the gold and blue keys to unlock their matching doors.', 'Altın ve mavi anahtarları toplayıp eşleşen kapıları aç.']),
  level(25, ['Escape from the Robot Base', 'Robot Üssünden Kaçış'], '###########/#S.C.K#..E#/#####D#.###/#B....#.###/#.#####.###/#...C.B.###/###########', 'R4 D2 L4 D2 R6 U4 R2',
    ['Combine crystals, a key, a locked door, and battery stops.', 'Kristalleri, anahtarı, kilitli kapıyı ve pil duraklarını birleştir.'], { energy: 10, batteryRequired: 'goal' }),
  level(26, ['The Rocket Component', 'Roket Parçası'], '#########/#S.#...E#/#..#.#..#/#..P.#..#/####.####/#########/#########', 'D2 R3 U2 R3',
    ['Recover the spacecraft component before delivering it to the base.', 'Uzay aracı parçasını bul ve üsse teslim et.'], { energy: 12, requiredItems: ['P'], component: ['Rocket component', 'Roket parçası'] }),
  level(27, ['Energy Module', 'Enerji Modülü'], '###########/#S....#..E#/#.###.#.###/#..B#.#.###/###.#.#.###/###..P.B###/###########', 'D2 R2 D2 R4 U4 R2',
    ['Use two battery stops to recover and deliver the energy module.', 'Enerji modülünü alıp teslim etmek için iki pil durağını kullan.'], { energy: 6, requiredItems: ['P'], batteryRequired: 'goal', component: ['Energy module', 'Enerji modülü'] }),
  level(28, ['Navigation Module', 'Navigasyon Modülü'], '###########/#S.......E#/#.###.###.#/#...#...#.#/###.#.#.#.#/#B..#.#...#/#.###.###.#/#....P..B.#/###########', 'D2 R2 D2 L2 D2 R8 U6',
    ['Explore the larger map and return with the navigation module.', 'Büyük haritayı keşfet ve navigasyon modülüyle geri dön.'], { energy: 10, requiredItems: ['P'], batteryRequired: 'goal', component: ['Navigation module', 'Navigasyon modülü'] }),
  level(29, ['Find the Launch Code', 'Fırlatma Kodunu Bul'], '###########/#S.a#....E#/###.#.###.#/#...#...#.#/#.#####.#.#/#b..B...#.#/#######.#.#/#######cB.#/###########', 'R2 D2 L2 D2 R6 D2 R2 U6',
    ['Collect all three K–Ş–F code fragments to unlock the Launch Center.', 'Fırlatma Merkezi’ni açmak için K–Ş–F kodunun üç parçasını da topla.'], { energy: 12, requiredItems: ['a', 'b', 'c'], batteryRequired: 'goal' }),
  level(30, ['KEŞFET-1: Launch Mission', 'KEŞFET-1: Fırlatma Görevi'], '#############/#S..C...#####/#######.#####/###....K#####/###.#########/###..D...B###/#########.###/###.......###/###.#########/###........R#/#############', 'R6 D2 L4 D2 R6 D2 L6 D2 R8',
    ['Crystal → key → door → battery → KEŞFET-1. At the rocket, use LAUNCH!', 'Kristal → anahtar → kapı → pil → KEŞFET-1. Rokette FIRLAT komutunu kullan!'], { energy: 20, batteryRequired: 'goal' })
];
