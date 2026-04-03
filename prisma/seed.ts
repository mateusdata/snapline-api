import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
// Se você usa o pacote 'pg' por baixo dos panos com o adapter, o padrão costuma ser:
// import { Pool } from 'pg';
// const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
// const adapter = new PrismaPg(pool);

// Mas seguindo EXATAMENTE o que você mandou:
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! } as any);
const prisma = new PrismaClient({ adapter: adapter });

async function main() {
  // Trava de segurança para não apagar o banco em produção
  if (process.env.DATABASE_URL?.includes("lsfn")) {
    console.log(process.env.DATABASE_URL);
    console.error("⛔ Seeding is disabled for production database.");
    process.exit(1);
  }

  // 1. Limpa os avatares antigos para não duplicar se você rodar o seed mais de uma vez
  console.log('Limpando tabela de avatares...');
  await prisma.avatar.deleteMany();

  // 2. Prepara a lista de avatares com os preços altos que definimos
  const avatarsToInsert = [
    { name: 'Avatar 1', imageUrl: "https://i.postimg.cc/MMfhrzcX/1.png", priceGems: 20000 },
    { name: 'Avatar 2', imageUrl: "https://i.postimg.cc/p5N3w389/2.png", priceGems: 22000 },
    { name: 'Avatar 3', imageUrl: "https://i.postimg.cc/4HCjDjtm/3.png", priceGems: 25000 },
    { name: 'Avatar 4', imageUrl: "https://i.postimg.cc/V0y2x2MJ/4.png", priceGems: 25000 },
    { name: 'Avatar 5', imageUrl: "https://i.postimg.cc/WqRxBxrt/5.png", priceGems: 30000 },
    { name: 'Avatar 6', imageUrl: "https://i.postimg.cc/D4VR9Rsq/6.png", priceGems: 30000 },
    { name: 'Avatar 7', imageUrl: "https://i.postimg.cc/wRKnCnJ5/7.png", priceGems: 35000 },
    { name: 'Avatar 8', imageUrl: "https://i.postimg.cc/m1xKvKMS/8.png", priceGems: 35000 },
    { name: 'Avatar 9', imageUrl: "https://i.postimg.cc/ZvkXGX3x/9.png", priceGems: 40000 },
    { name: 'Avatar 10', imageUrl: "https://i.postimg.cc/dZMgbgd5/10.png", priceGems: 40000 },
    { name: 'Avatar 11', imageUrl: "https://i.postimg.cc/jnzBtvQN/11.png", priceGems: 45000 },
    { name: 'Avatar 12', imageUrl: "https://i.postimg.cc/n9vNpTYB/12.png", priceGems: 45000 },
    { name: 'Avatar 13', imageUrl: "https://i.postimg.cc/y3F2snXh/13.png", priceGems: 50000 },
    { name: 'Avatar 14', imageUrl: "https://i.postimg.cc/K3nCxQrD/14.png", priceGems: 50000 },
    { name: 'Avatar 15', imageUrl: "https://i.postimg.cc/n9vNpTY1/15.png", priceGems: 60000 },
    { name: 'Avatar 16', imageUrl: "https://i.postimg.cc/n9vNpTYk/16.png", priceGems: 60000 },
    { name: 'Avatar Lendário', imageUrl: "https://i.postimg.cc/64dFtzLM/17.png", priceGems: 100000 },
  ];

  // 3. Insere todos no banco (usar createMany é mais rápido e limpo que um for)
  await prisma.avatar.createMany({
    data: avatarsToInsert,
  });

  console.log(`✅ Seed completed: ${avatarsToInsert.length} avatares criados na loja.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });