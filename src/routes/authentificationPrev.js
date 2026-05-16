const bcrypt = require("bcryptjs");

const registerSchema = {
  body: {
    required: ["login", "password", "name", "surname","lastname", "phone", "email"],
    properties: {
      login: {
        type: "string",
        pattern: "^[A-Za-z0-9]{6,}"
      },
      password: {
        type: "string",
        minLength: 8
      },
      name: {
        type: "string"
      },
      surname: {
        type: "string"
      },
      lastname: {
        type: 'string'
      },
      phone: {
        type: "string",
        pattern: "^8\\d{10}$"
      },
      email: {
        type: "string",
        format: "email"
      }
    }
  }
}

const signinSchema = {
  body: {
    required: ["login", "password"],
    properties: {
      login: {
        type: "string"
      },
      password: {
        type: "string"
      }
    }
  }
}

module.exports = async function routes (fastify, options) {
  fastify.post("/signup", { schema: registerSchema }, async (req, res) => {
    const { password, ...userData } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10)
    try {
      const user = await fastify.prisma.user.create({
        data: { ...userData, password: hashedPassword }
      });
      return res.code(201).send({ success: true, message: "User created" });
    } catch (e) {
      // Если Prisma выдает ошибку уникальности (P2002)
      if (e.code === 'P2002') {
        return res.code(409).send({
          error: "conflict",
          message: "User with this login or email already exists"
        });
      }
      return res.code(400).send({ error: "bad_request", message: "Invalid data" });
    }
  });

  fastify.post("/signin", {schema: signinSchema}, async (req, res) => {
    const { login, password } = req.body;
    const user = await fastify.prisma.user.findUnique({ where: { login } });

    // Проверка существования и пароля
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.code(401).send({
        error: "invalid_credentials",
        message: "Incorrect login or password"
      });
    }

    // авторизация
    const token = fastify.jwt.sign({ id: user.id, role: user.role });

    res.setCookie("access_token", token, {
      maxAge: 3600 * 24,
      path: "/",
      signed: true,
      httpOnly: true,
    });

    return res.send({success: true})
    // return { success: true, redirect: "/app/feed" };
  });

  fastify.post('/logout', async (req, res) => {
    return res.clearCookie('access_token', { path: '/' }).send({ success: true })
  })



  // ejs

  fastify.get("/signup", async (req, res) => {
    return res.view("signup.ejs");
  });

  fastify.get("/signin", async (req, res) => {
    return res.view("signin.ejs");
  });

}
