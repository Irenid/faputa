const fastify = require("fastify")({logger: true});
const { PrismaClient } = require('@prisma/client')
const path = require("path");


// Prisma
const prisma = new PrismaClient({ log: ['query', 'error', 'warn'] })
fastify.decorate("prisma", prisma) // Делаем доступным через fastify.prisma
fastify.addHook("onClose", () => prisma.$disconnect())


fastify.register(require("@fastify/formbody"))

fastify.register(require("@fastify/jwt"), {
  secret: "supersecretparol",
  logger: false
})

fastify.register(require('@fastify/cookie'), {
  secret: 'supersecretparol',
  cookie: {
    signed: true,
    httpOnly: true,
    sameSite: 'strict',
    path: '/'
  }
});

fastify.register(require("@fastify/view"), {
  engine: {
    ejs: require("ejs"),
  },
  root: path.join(__dirname, "views"), // папка, где будут лежать страницы
});

fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/public/", // файлы будут доступны по адресу /public/...
});



// midleware

fastify.decorate("authenticate", async (req, res) =>{
  try {
    const token = req.cookies.access_token;
    if (!token) {
      return res.redirect("/users/signin")
    }
    const unsigned = fastify.unsignCookie(token)
    if (!unsigned.valid) {
      return res.redirect("/users/signin")
    }
    req.user = fastify.jwt.verify(unsigned.value)
    console.log(req.user)
  } catch (e) {
    return res.redirect("/users/signin");
  }
})

fastify.setNotFoundHandler((request, reply) => {
  reply.redirect('/requests/my-requests'); // Перенаправляем на главную
});

// Routes
fastify.register(import("./routes/authentification.js"), {prefix: '/users'})
fastify.register(import("./routes/requests.js"), {prefix: '/requests'})

const start = async () => {
  try {
    await fastify.listen({port:3000})
  } catch (e) {
    fastify.log.error(e)
    process.exit(1)
  }
}

void start()