import swaggerJsdoc from 'swagger-jsdoc';

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'AI Feedback Platform API',
      version: '1.0.0',
      description: 'REST API for QR, feedback, business, health, and admin operations'
    },
    servers: [
      { url: `http://localhost:${process.env.PORT || 3001}` }
    ]
  },
  apis: [
    `${__dirname}/../routes/*.ts`
  ]
});


