import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! } as any);
const prisma = new PrismaClient({ adapter: adapter });

async function main() {
  if (process.env.DATABASE_URL?.includes("lsfn")) {
    console.error("⛔ Seeding is disabled for production database.");
    process.exit(1);
  }

  console.log('🚀 Iniciando atualização da loja de avatares...');

  const avatarsToInsert = [
    { name: 'Zero Dois', imageUrl: "https://i.postimg.cc/wRKnCnJ5/7.png", priceGems: 15000 },
    { name: 'Zé Assombra', imageUrl: "https://i.postimg.cc/m1xKvKMS/8.png", priceGems: 145000 },
    { name: 'Aranhosa', imageUrl: "https://i.postimg.cc/dZMgbgd5/10.png", priceGems: 40000 },
    { name: 'Funguinho Bravo', imageUrl: "https://i.postimg.cc/jnzBtvQN/11.png", priceGems: 45000 },
    { name: 'Mimosa', imageUrl: "https://i.postimg.cc/n9vNpTYB/12.png", priceGems: 160000 },
    { name: 'Pinguim Perdido', imageUrl: "https://i.postimg.cc/y3F2snXh/13.png", priceGems: 50000 },
    { name: 'Valentão', imageUrl: "https://i.postimg.cc/n9vNpTYk/16.png", priceGems: 150000 },
    { name: 'Gatona', imageUrl: "https://i.postimg.cc/p5zHkpyz/18.png", priceGems: 25000 },
    { name: 'Ossinho', imageUrl: "https://i.postimg.cc/m1CsVttW/19.png", priceGems: 35000 },
    { name: 'Pergaminho', imageUrl: "https://i.postimg.cc/1VwQMffQ/20.png", priceGems: 20000 },
    { name: 'Égua, Mano!', imageUrl: "https://i.postimg.cc/1VwQMffZ/21.png", priceGems: 45000 },
    { name: 'Mózão', imageUrl: "https://i.postimg.cc/BPH0NXXs/22.png", priceGems: 15000 },
    { name: 'Espertinho', imageUrl: "https://i.postimg.cc/WtkTsfSh/23.png", priceGems: 30000 },
    { name: 'Gaspazinho', imageUrl: "https://i.postimg.cc/3WvY3b9k/24.png", priceGems: 18000 },
    { name: 'Xerife', imageUrl: "https://i.postimg.cc/jC7tRkvn/25.png", priceGems: 40000 },
  ];

  const result = await prisma.avatar.createMany({
    data: avatarsToInsert,
    skipDuplicates: true,
  });

  console.log(`✅ Seed finalizado: ${result.count} novos registros adicionados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });