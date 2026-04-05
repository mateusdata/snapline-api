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
  { name: 'Pan', imageUrl: "https://i.postimg.cc/wRKnCnJ5/7.png", priceGems: 15000 },
  { name: 'Fantasma Malvado', imageUrl: "https://i.postimg.cc/m1xKvKMS/8.png", priceGems: 145000 },
  { name: 'Aranha Coração', imageUrl: "https://i.postimg.cc/dZMgbgd5/10.png", priceGems: 40000 },
  { name: 'Gogumelo', imageUrl: "https://i.postimg.cc/jnzBtvQN/11.png", priceGems: 45000 },
  { name: 'Vaca Fofa', imageUrl: "https://i.postimg.cc/n9vNpTYB/12.png", priceGems: 160000 },
  { name: 'Pinguinho', imageUrl: "https://i.postimg.cc/y3F2snXh/13.png", priceGems: 50000 },
  { name: 'Malvadão', imageUrl: "https://i.postimg.cc/n9vNpTYk/16.png", priceGems: 150000 },
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