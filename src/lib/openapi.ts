export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Brinto Fastify API',
    version: '0.0.1',
    description: 'Interactive Swagger / Scalar API documentation for Brinto Node.js TypeScript + Fastify MongoDB Backend (Vercel Ready)',
  },
  servers: [
    {
      url: '/',
      description: 'Current Environment',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token obtained from /api/users/auth-mobile',
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  tags: [
    {
      name: 'System',
      description: 'API status and metadata',
    },
    {
      name: 'Database',
      description: 'Database health checks',
    },
    {
      name: 'Users',
      description: 'User management endpoints',
    },
    {
      name: 'Orders',
      description: 'Order management endpoints',
    },
    {
      name: 'Field Values',
      description: 'Legacy field values CRUD endpoints migrated to the new API structure',
    },
    {
      name: 'Forms',
      description: 'Form management and input mapping endpoints',
    },
    {
      name: 'Documents',
      description: 'User document management endpoints',
    },
    {
      name: 'Order Additional Documents',
      description: 'Order additional documents management endpoints',
    },
    {
      name: 'Payments',
      description: 'Payment integration and Cashfree webhook endpoints',
    },
    {
      name: 'Store Owners',
      description: 'Store management, store forms, and subscriptions',
    },
    {
      name: 'Mocktests',
      description: 'Mock test, question, and answer option management',
    },
    {
      name: 'Mocktest Passages',
      description: 'Passage management and random passage selection for mocktests',
    },
  ],
  paths: {
    '/api/mocktest-passages': {
      get: {
        tags: ['Mocktest Passages'],
        summary: 'Get a Random Passage',
        description: 'Returns one random passage, optionally filtered by exact test_name and excluding passage IDs supplied through exclude_ids. Pass multiple IDs as comma-separated values or repeated exclude_ids parameters. Responses are not shared-cached so repeated requests can return different passages.',
        security: [],
        parameters: [
          { name: 'test_name', in: 'query', required: false, schema: { type: 'string' }, example: 'SSC CGL' },
          { name: 'exclude_ids', in: 'query', required: false, schema: { type: 'array', items: { type: 'integer', minimum: 1 } }, style: 'form', explode: false, example: '12,15' },
        ],
        responses: {
          '200': { description: 'One random matching passage' },
          '400': { description: 'test_name was empty or exclude_ids contains an invalid passage ID' },
          '404': { description: 'No matching passage exists' },
          '503': { description: 'Turso configuration is missing' },
        },
      },
      post: {
        tags: ['Mocktest Passages'],
        summary: 'Create Passage(s)',
        description: 'Creates one passage or an array of passages associated with test names. Array creation is atomic. Admin authentication is required.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    type: 'object',
                    required: ['passage_text', 'test_name'],
                    properties: {
                      passage_text: { type: 'string', example: 'Read the passage carefully and answer the following questions.' },
                      test_name: { type: 'string', example: 'SSC CGL' },
                    },
                  },
                  {
                    type: 'array',
                    minItems: 1,
                    items: {
                      type: 'object',
                      required: ['passage_text', 'test_name'],
                      properties: {
                        passage_text: { type: 'string' },
                        test_name: { type: 'string' },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Passage or passages created successfully' },
          '400': { description: 'Invalid passage payload' },
          '401': { description: 'Missing or invalid authentication token' },
          '403': { description: 'Admin role required' },
          '503': { description: 'Turso configuration is missing' },
        },
      },
    },
    '/api/mocktest-passages/results': {
      post: {
        tags: ['Mocktest Passages'],
        summary: 'Save passage typing result',
        description: 'Stores a final typing result for a session and passage, owned by the verified JWT mobile or the guest identified by X-Guest-Id. The server calculates total_word_count from the passage text and returns pending_word_count.',
        security: [{ bearerAuth: [] }, {}],
        parameters: [
          { name: 'X-Guest-Id', in: 'header', required: false, schema: { type: 'string' }, description: 'Required for guest requests. Send the same guest ID used for mock-test sessions.' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['session_id', 'passage_id', 'keystrokes_count', 'error_count', 'backspace_count', 'typed_word_count'],
                properties: {
                  session_id: { type: 'string', example: 'typing-session-123' },
                  passage_id: { type: 'integer', minimum: 1, example: 42 },
                  keystrokes_count: { type: 'integer', minimum: 0, example: 450 },
                  error_count: { type: 'integer', minimum: 0, example: 3 },
                  backspace_count: { type: 'integer', minimum: 0, example: 8 },
                  typed_word_count: { type: 'integer', minimum: 0, example: 120 },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Typing result saved successfully' },
          '400': { description: 'Invalid request payload or count values' },
          '401': { description: 'Valid JWT or X-Guest-Id is required' },
          '403': { description: 'User role is not allowed or the JWT has no mobile claim' },
          '404': { description: 'Passage not found' },
          '409': { description: 'Typing result belongs to another user' },
          '503': { description: 'Turso configuration is missing' },
        },
      },
      get: {
        tags: ['Mocktest Passages'],
        summary: 'Get passage typing results',
        description: 'Returns all typing results owned by the verified JWT mobile or the guest identified by X-Guest-Id. Optionally filter by session_id and/or passage_id.',
        security: [{ bearerAuth: [] }, {}],
        parameters: [
          { name: 'session_id', in: 'query', required: false, schema: { type: 'string' }, example: 'typing-session-123' },
          { name: 'passage_id', in: 'query', required: false, schema: { type: 'integer', minimum: 1 }, example: 42 },
          { name: 'X-Guest-Id', in: 'header', required: false, schema: { type: 'string' }, description: 'Required for guest requests. Send the same guest ID used when saving the result.' },
        ],
        responses: {
          '200': { description: 'Typing results belonging to the authenticated user or guest' },
          '400': { description: 'session_id is empty or passage_id is invalid' },
          '401': { description: 'Valid JWT or X-Guest-Id is required' },
          '403': { description: 'User role is not allowed or the JWT has no mobile claim' },
          '503': { description: 'Turso configuration is missing' },
        },
      },
    },
    '/api/mocktests': {
      get: {
        tags: ['Mocktests'],
        summary: 'List Mock Tests for Home Screen',
        description: 'Returns paginated mock-test card data without questions or answer details. Results are ordered newest first.',
        security: [],
        parameters: [
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
        ],
        responses: {
          '200': { description: 'Paginated mock test summaries' },
          '400': { description: 'Invalid page or limit parameter' },
          '503': { description: 'Turso configuration is missing' },
        },
      },
      post: {
        tags: ['Mocktests'],
        summary: 'Create Mock Test',
        description: 'Creates a mock test and its questions and answer options in one Turso transaction. The tests.questions count is derived from the questions array.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'exam', 'questions'],
                properties: {
                  title: { type: 'string', maxLength: 255, example: 'General Aptitude Mock Test 1' },
                  exam: { type: 'string', maxLength: 100, example: 'SSC CGL' },
                  duration: { type: 'integer', minimum: 0, default: 0, example: 60 },
                  difficulty: { type: 'string', maxLength: 20, default: 'Medium', example: 'Medium' },
                  attempts: { type: 'integer', minimum: 0, default: 0, example: 0 },
                  rating: { type: 'number', minimum: 0, default: 0, example: 0 },
                  is_new: { type: 'boolean', default: false, example: true },
                  is_free: { type: 'boolean', default: true, example: true },
                  questions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['section', 'text', 'options'],
                      properties: {
                        section: { type: 'string', maxLength: 100, example: 'Quantitative Aptitude' },
                        text: { type: 'string', example: 'What is 12 multiplied by 8?' },
                        explanation: { type: 'string', nullable: true, example: '12 x 8 = 96.' },
                        options: {
                          type: 'array',
                          items: {
                            type: 'object',
                            required: ['text'],
                            properties: {
                              text: { type: 'string', maxLength: 500, example: '96' },
                              is_correct: { type: 'boolean', default: false, example: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Mock test with its questions and options created successfully' },
          '400': { description: 'Invalid request payload' },
          '401': { description: 'Missing, expired, or invalid authentication token, or unknown X-Guest-Id' },
          '403': { description: 'Authenticated user does not have the ADMIN role' },
          '500': { description: 'Mock test could not be created' },
          '503': { description: 'Turso configuration is missing' },
        },
      },
    },
    '/api/mocktests/sessions': {
      post: {
        tags: ['Mocktests'],
        summary: 'Create Mock Test Session',
        description: 'Creates a test-specific session for a registered user or guest. Registered users are identified by the verified JWT mobile claim. Guests receive a high-entropy guestId that must be stored securely and sent as X-Guest-Id on later requests. Submit attempts to POST /api/mocktests/attempts; the test ID is read from this session.',
        security: [{ bearerAuth: [] }, {}],
        parameters: [
          { name: 'X-Guest-Id', in: 'header', required: false, schema: { type: 'string' }, description: 'Omit on first guest session creation; reuse the returned guestId on later guest requests.' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['testId'],
                properties: {
                  testId: { type: 'integer', minimum: 1, example: 1 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Session created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: '1eecf518-25a0-4fa5-81dc-3c5a99c86d36' },
                        displayName: { type: 'string', nullable: true, example: 'student01' },
                        testId: { type: 'integer', example: 1 },
                        guestId: { type: 'string', description: 'Returned only when a new guest identity is created.' },
                        createdAt: { type: 'string', example: '2026-10-09 12:00:00' },
                        lastSeen: { type: 'string', example: '2026-10-09 12:00:00' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid JSON or testId' },
          '401': { description: 'Invalid authentication token or unknown X-Guest-Id' },
          '403': { description: 'User role is not allowed or the JWT has no mobile claim' },
          '404': { description: 'Mock test not found' },
          '503': { description: 'Turso configuration is missing' },
        },
      },
    },
    '/api/mocktests/{testId}': {
      get: {
        tags: ['Mocktests'],
        summary: 'Get Mock Test For Attempt',
        description: 'Returns test questions and options without answer keys or explanations.',
        security: [],
        parameters: [
          { name: 'testId', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } },
        ],
        responses: {
          '200': { description: 'Test and answer options without correctness data' },
          '404': { description: 'Mock test not found' },
          '503': { description: 'Turso configuration is missing' },
        },
      },
    },
    '/api/mocktests/my-attempts': {
      get: {
        tags: ['Mocktests'],
        summary: 'Get Current User or Guest Mock Test Attempts',
        description: 'Returns paginated test and result summaries for the verified JWT mobile or the guest identity supplied in X-Guest-Id. An authorized JWT takes precedence; if the token is missing or invalid, a valid X-Guest-Id can authenticate the request.',
        security: [{ bearerAuth: [] }, {}],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
          { name: 'X-Guest-Id', in: 'header', required: false, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Paginated attempt history; an empty history returns an empty data array' },
          '400': { description: 'Invalid page or limit query parameter' },
          '401': { description: 'Authentication or X-Guest-Id is missing or invalid' },
          '403': { description: 'User role is not allowed or the JWT has no mobile claim' },
          '503': { description: 'Turso configuration is missing' },
        },
      },
    },
    '/api/mocktests/attempts': {
      post: {
        tags: ['Mocktests'],
        summary: 'Submit Mock Test Attempt',
        description: 'Looks up the test ID from the session, verifies session ownership using the authenticated user mobile or X-Guest-Id, scores answers on the server, and atomically stores the attempt, answers, and section totals. Score is the number of correct answers. Questions omitted from answers are counted as skipped.',
        security: [{ bearerAuth: [] }, {}],
        parameters: [
          { name: 'X-Guest-Id', in: 'header', required: false, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sessionId', 'timeTaken', 'answers'],
                properties: {
                  sessionId: { type: 'string', example: '1eecf518-25a0-4fa5-81dc-3c5a99c86d36' },
                  timeTaken: { type: 'integer', minimum: 0, example: 840 },
                  answers: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['questionId', 'selectedOptionId'],
                      properties: {
                        questionId: { type: 'integer', minimum: 1, example: 42 },
                        selectedOptionId: { type: 'integer', nullable: true, minimum: 1, example: 108 },
                        isMarked: { type: 'boolean', default: false, example: false },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Attempt submitted and scored successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Mock test attempt submitted successfully' },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer', example: 12 },
                        testId: { type: 'integer', example: 1 },
                        score: { type: 'integer', description: 'Number of correct answers', example: 8 },
                        correct: { type: 'integer', example: 8 },
                        wrong: { type: 'integer', example: 1 },
                        skipped: { type: 'integer', example: 1 },
                        marked: { type: 'integer', example: 2 },
                        timeTaken: { type: 'integer', example: 840 },
                        totalQuestions: { type: 'integer', example: 10 },
                        submittedAt: { type: 'string', example: '2026-10-09 12:15:00' },
                        sections: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              sectionName: { type: 'string', example: 'Quantitative Aptitude' },
                              correct: { type: 'integer', example: 4 },
                              wrong: { type: 'integer', example: 1 },
                              skipped: { type: 'integer', example: 0 },
                              total: { type: 'integer', example: 5 },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid answers, session, or request payload' },
          '401': { description: 'Authentication or X-Guest-Id is missing or invalid' },
          '403': { description: 'User role is not allowed or the JWT has no mobile claim' },
          '404': { description: 'Mock test associated with the session not found' },
          '503': { description: 'Turso configuration is missing' },
        },
      },
    },
    '/api/mocktests/guest/link': {
      post: {
        tags: ['Mocktests'],
        summary: 'Link Guest Attempts To User Account',
        description: 'Associates sessions belonging to X-Guest-Id with the authenticated user mobile, preserving guest attempt history after registration or login.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'X-Guest-Id', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Guest sessions linked to the authenticated user' },
          '400': { description: 'Invalid guest ID' },
          '401': { description: 'Missing or invalid authentication token' },
          '403': { description: 'User role or mobile claim is not allowed' },
          '404': { description: 'No guest sessions found for this guest ID' },
          '503': { description: 'Turso configuration is missing' },
        },
      },
    },
    '/': {
      get: {
        tags: ['System'],
        summary: 'Root API Status',
        description: 'Returns API service status and available endpoint links',
        responses: {
          '200': {
            description: 'API online status',
          },
        },
      },
    },
    '/api/health': {
      get: {
        tags: ['Database'],
        summary: 'Health Check',
        description: 'Returns server health and MongoDB connection status',
        responses: {
          '200': {
            description: 'System healthy',
          },
          '503': {
            description: 'Database disconnected',
          },
        },
      },
    },
    '/api/users': {
      get: {
        tags: ['Users'],
        summary: 'List Users',
        description: 'Returns list of up to 50 users (excluding passwords) with Cloudflare KV caching',
        responses: {
          '200': {
            description: 'List of users',
          },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create User',
        description: 'Creates a new user record and invalidates users KV cache',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['user_name', 'phone', 'password', 'user_id'],
                properties: {
                  name: { type: 'string', example: 'John Doe' },
                  user_name: { type: 'string', example: 'johndoe123' },
                  phone: { type: 'string', example: '9876543210' },
                  email: { type: 'string', example: 'john@example.com' },
                  password: { type: 'string', example: 'SecretPass123' },
                  user_id: { type: 'string', example: 'u_johndoe123' },
                  role: {
                    type: 'array',
                    items: { type: 'string', enum: ['USER', 'ADMIN', 'STORE_OWNER'] },
                    example: ['USER'],
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'User created successfully',
          },
          '400': {
            description: 'Validation error (missing required fields)',
          },
        },
      },
    },
    '/api/users/auth-mobile': {
      post: {
        tags: ['Users'],
        summary: 'Authenticate Mobile Number',
        description: 'Authenticates or registers a user via mobile phone number and issues a JWT token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['mobile'],
                properties: {
                  mobile: { type: 'string', example: '9876543210' },
                  isInputMobile: { type: 'boolean', example: false },
                  login_platform: {
                    type: 'string',
                    enum: ['web', 'ios', 'android', 'other'],
                    example: 'web',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Mobile authenticated or registered successfully (returns user + JWT token or confirmation message)',
          },
          '400': {
            description: 'Bad Request (missing mobile number or invalid payload)',
          },
        },
      },
    },
    '/api/users/login': {
      post: {
        tags: ['Users'],
        summary: 'Login User with Username and Password',
        description: 'Authenticates a user using user_name (or user_id) and password and issues a JWT token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['user_name', 'password'],
                properties: {
                  user_name: { type: 'string', example: 'mahavir' },
                  password: { type: 'string', example: 'SecretPass123' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'User authenticated successfully (returns user details and JWT token)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        user: {
                          type: 'object',
                          properties: {
                            _id: { type: 'string', example: '69d32580d1651be887480093' },
                            name: { type: 'string', example: '' },
                            user_name: { type: 'string', example: 'mahavir' },
                            phone: { type: 'string', example: '8260813875' },
                            email: { type: 'string', example: '' },
                            password: { type: 'string', example: '' },
                            role: {
                              type: 'array',
                              items: { type: 'string' },
                              example: ['STORE_OWNER'],
                            },
                            user_id: { type: 'string', example: 'B096' },
                            status: { type: 'number', example: 1 },
                            createdAt: { type: 'string', example: '2026-04-06T03:16:16.411Z' },
                            updatedAt: { type: 'string', example: '2026-04-06T03:16:16.411Z' },
                            __v: { type: 'number', example: 0 },
                            id: { type: 'string', example: '69d32580d1651be887480093' },
                          },
                        },
                        token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad Request (invalid credentials or missing parameters)',
          },
        },
      },
    },
    '/api/documents': {
      get: {
        tags: ['Documents'],
        summary: 'Get User Documents',
        description: 'Fetches paginated list of user documents (mydoc, order) for the authenticated user',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', example: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', example: 10 } },
        ],
        responses: {
          '200': { description: 'Paginated user documents list' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/documents/{id}': {
      get: {
        tags: ['Documents'],
        summary: 'Get User Document Details',
        description: 'Fetches document metadata by MongoDB ID for the authenticated owner; binary file data is not returned',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Document metadata' },
          '400': { description: 'Invalid document ID' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Document not found or not owned by the user' },
        },
      },
    },
    '/api/documents/{id}/upload-status': {
      patch: {
        tags: ['Documents'],
        summary: 'Update User Document Upload Status',
        description: 'Updates the authenticated user document status. Setting uploaded=true requires the R2 object to exist.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['uploaded'],
            properties: { uploaded: { type: 'boolean' } },
          } } },
        },
        responses: {
          '200': { description: 'Document upload status updated' },
          '400': { description: 'Invalid ID or request body' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Document not found or not owned by the user' },
          '409': { description: 'R2 object has not been uploaded' },
        },
      },
    },
    '/api/get-blog-upload-url': {
      post: {
        tags: ['Documents'],
        summary: 'Generate Blog Upload URL',
        description: 'Creates a 10-minute Cloudflare R2 presigned PUT URL for a blog file',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object',
            required: ['fileName'],
            properties: {
              fileName: { type: 'string', example: 'blog-document.pdf' },
              contentType: { type: 'string', default: 'application/pdf' },
            },
          } } },
        },
        responses: {
          '200': { description: 'Presigned upload URL and object key' },
          '400': { description: 'Missing or invalid fileName/contentType' },
          '500': { description: 'R2 configuration or signing error' },
        },
      },
    },
    '/api/get-user-upload-url': {
      post: {
        tags: ['Documents'],
        summary: 'Generate Authenticated User Upload URL',
        description: 'Creates a pending document record and a 10-minute Cloudflare R2 presigned PUT URL scoped to the authenticated user',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object',
            required: ['fileName'],
            properties: {
              fileName: { type: 'string', example: 'document.pdf' },
              contentType: { type: 'string', default: 'application/pdf' },
            },
          } } },
        },
        responses: {
          '200': { description: 'User-scoped presigned upload URL, object key, and pending document ID' },
          '400': { description: 'Missing or invalid fileName/contentType' },
          '401': { description: 'Unauthorized' },
          '500': { description: 'R2 configuration or signing error' },
        },
      },
    },
    '/api/orders/my-orders': {
      get: {
        tags: ['Orders'],
        summary: 'Get Current User Orders',
        description: 'Lists all orders created by the authenticated user with Cloudflare KV caching',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', example: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', example: 10 } },
        ],
        responses: {
          '200': { description: 'List of user orders' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/orders/my-printorders': {
      get: {
        tags: ['Orders'],
        summary: 'Get Current User Printing Orders',
        description: 'Lists all printing orders created by the authenticated user',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', example: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', example: 10 } },
        ],
        responses: {
          '200': { description: 'List of printing orders' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/orders/my-printorders/{orderId}': {
      get: {
        tags: ['Orders'],
        summary: 'Get Printing Order Details',
        description: 'Fetches details for a specific printing order belonging to the user',
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Printing order details' },
          '400': { description: 'Bad Request / Order not found' },
        },
      },
    },
    '/api/orders/non-printing': {
      get: {
        tags: ['Orders'],
        summary: 'Get Non-Printing Orders',
        description: 'Fetches all non-printing orders (orderType != PRINTING) with populated details',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', example: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', example: 10 } },
        ],
        responses: {
          '200': { description: 'Non-printing orders list' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/orders/non-printing/{orderId}': {
      get: {
        tags: ['Orders'],
        summary: 'Get Non-Printing Order Details',
        description: 'Fetches full details for a specific non-printing order',
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Non-printing order details' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/orders/admin/non-printing': {
      get: {
        tags: ['Orders'],
        summary: 'Admin Get All Non-Printing Orders',
        description: 'Fetches paginated list of all non-printing orders (orderType != PRINTING) for Admin users',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', example: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', example: 10 } },
        ],
        responses: {
          '200': { description: 'Paginated non-printing orders list' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden (Admin role required)' },
        },
      },
    },
    '/api/orders/admin/counts': {
      get: {
        tags: ['Orders'],
        summary: 'Admin Get Order Counts By Status',
        description: 'Returns total count of orders grouped by status, paymentStatus, and orderType',
        responses: {
          '200': { description: 'Order status counts summary' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/api/orders/admin/details/{orderId}': {
      get: {
        tags: ['Orders'],
        summary: 'Admin Get Full Order Details By ID',
        description: 'Fetches full order details including populated user, form, fieldValues, submission, payments, and results for Admin users',
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Full order details' },
          '400': { description: 'Order not found' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/api/orders/create': {
      post: {
        tags: ['Orders'],
        summary: 'Create New Order',
        description: 'Creates a standard order',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  form: { type: 'string', example: '69354f8d55f23937dc3389c3' },
                  totalAmount: { type: 'number', example: 199 },
                  discount: { type: 'number', example: 0 },
                  promoCode: { type: 'string', example: 'BRINTO10' },
                  storeId: { type: 'string', example: 'STORE-001' },
                  orderType: { type: 'string', enum: ['NORMAL', 'QUICK', 'WHATSAPP', 'PRINTING', 'AI'], example: 'NORMAL' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Order created successfully' },
        },
      },
    },
    '/api/orders/create-with-details': {
      post: {
        tags: ['Orders'],
        summary: 'Create Order With Details',
        description: 'Creates an order with backend price calculation and field values',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['formObjId'],
                properties: {
                  formObjId: { type: 'string', example: '69354f8d55f23937dc3389c3' },
                  formId: { type: 'string', example: 'FORM-053' },
                  promoCode: { type: 'string', example: 'BRINTO10' },
                  contactNo: { type: 'string', example: '9876543210' },
                  fieldValues: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        bindValue: { type: 'string', example: 'father_s_name' },
                        value: { type: 'string', example: 'John Doe' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Order and submission details created successfully' },
        },
      },
    },
    '/api/orders/create-whatsapp': {
      post: {
        tags: ['Orders'],
        summary: 'Create WhatsApp Order',
        description: 'Creates a WhatsApp order with initial blank field mappings',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['formObjId'],
                properties: {
                  formObjId: { type: 'string', example: '69354f8d55f23937dc3389c3' },
                  formId: { type: 'string', example: 'FORM-053' },
                  contactNo: { type: 'string', example: '9876543210' },
                  promoCode: { type: 'string', example: 'BRINTO10' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'WhatsApp order created successfully' },
        },
      },
    },
    '/api/orders/create-ai': {
      post: {
        tags: ['Orders'],
        summary: 'Create AI Order',
        description: 'Creates an AI order with initial blank field mappings for AI inputs',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['formObjId'],
                properties: {
                  formObjId: { type: 'string', example: '69354f8d55f23937dc3389c3' },
                  formId: { type: 'string', example: 'FORM-053' },
                  contactNo: { type: 'string', example: '9876543210' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'AI order created successfully' },
        },
      },
    },
    '/api/orders/create-printing': {
      post: {
        tags: ['Orders'],
        summary: 'Create Printing Order',
        description: 'Creates a printing order with documents and print configurations',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['totalAmount', 'printItems'],
                properties: {
                  totalAmount: { type: 'number', example: 150 },
                  printItems: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        document: { type: 'string', example: '6a2d1040e8d3e417a670b8ca' },
                        copies: { type: 'number', example: 2 },
                        colorMode: { type: 'string', enum: ['color', 'bw'], example: 'bw' },
                        paperSize: { type: 'string', enum: ['A4', 'A3', 'Letter'], example: 'A4' },
                        sides: { type: 'string', enum: ['simplex', 'duplex'], example: 'simplex' },
                        price: { type: 'number', example: 150 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Printing order created successfully' },
        },
      },
    },
    '/api/orders/{orderId}': {
      get: {
        tags: ['Orders'],
        summary: 'Get Order By ID',
        description: 'Fetches details of a specific order by orderId',
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Order details' },
        },
      },
      patch: {
        tags: ['Orders'],
        summary: 'Update Order Details',
        description: 'Updates order fields (Admin only)',
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'DRAFT', 'CART'], example: 'COMPLETED' },
                  paymentStatus: { type: 'string', enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'], example: 'SUCCESS' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Order updated successfully' },
        },
      },
    },
    '/api/orders/{orderId}/status': {
      patch: {
        tags: ['Orders'],
        summary: 'Change Order Status By Path Parameter',
        description: 'Updates the status of a specific order using the orderId path parameter',
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: {
                    type: 'string',
                    enum: ['PENDING', 'PROCESSING', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'DRAFT', 'CART'],
                    example: 'PROCESSING',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Order status updated successfully' },
          '400': { description: 'Bad Request / Invalid status' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
      put: {
        tags: ['Orders'],
        summary: 'Change Order Status By Path Parameter (PUT)',
        description: 'Updates the status of a specific order using the orderId path parameter',
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: {
                    type: 'string',
                    enum: ['PENDING', 'PROCESSING', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'DRAFT', 'CART'],
                    example: 'PROCESSING',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Order status updated successfully' },
          '400': { description: 'Bad Request / Invalid status' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/api/orders/status': {
      patch: {
        tags: ['Orders'],
        summary: 'Change Order Status By Body Parameters',
        description: 'Updates the status of an order specified in the JSON body payload (orderId & status)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orderId', 'status'],
                properties: {
                  orderId: { type: 'string', example: 'ORD-1790493446580' },
                  status: {
                    type: 'string',
                    enum: ['PENDING', 'PROCESSING', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'DRAFT', 'CART'],
                    example: 'COMPLETED',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Order status updated successfully' },
          '400': { description: 'Bad Request / Missing orderId or status' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
      put: {
        tags: ['Orders'],
        summary: 'Change Order Status By Body Parameters (PUT)',
        description: 'Updates the status of an order specified in the JSON body payload (orderId & status)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orderId', 'status'],
                properties: {
                  orderId: { type: 'string', example: 'ORD-1790493446580' },
                  status: {
                    type: 'string',
                    enum: ['PENDING', 'PROCESSING', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'DRAFT', 'CART'],
                    example: 'COMPLETED',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Order status updated successfully' },
          '400': { description: 'Bad Request / Missing orderId or status' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/api/orders/{orderId}/apply-promo': {
      post: {
        tags: ['Orders'],
        summary: 'Apply Promo Code To Order',
        description: 'Applies and calculates promo code discount for an unpaid order',
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['promoCode'],
                properties: {
                  promoCode: { type: 'string', example: 'BRINTO10' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Promo code applied successfully' },
        },
      },
    },
    '/api/field-values': {
      post: {
        tags: ['Field Values'],
        summary: 'Create Field Value(s)',
        description: 'Creates one field value or multiple field values for an order',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    type: 'object',
                    required: ['orderId', 'inputDef', 'value'],
                    properties: {
                      orderId: { type: 'string', example: 'ORD-1790493446580' },
                      inputDef: { type: 'string', example: '66e56934d97f74c4923efc55' },
                      fieldName: { type: 'string', example: 'Father Name' },
                      bindValue: { type: 'string', example: 'father_s_name' },
                      value: { type: 'string', example: 'John Doe' },
                    },
                  },
                  {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        orderId: { type: 'string', example: 'ORD-1790493446580' },
                        inputDef: { type: 'string', example: '66e56934d97f74c4923efc55' },
                        fieldName: { type: 'string', example: 'Father Name' },
                        bindValue: { type: 'string', example: 'father_s_name' },
                        value: { type: 'string', example: 'John Doe' },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Field value(s) created successfully' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/api/field-values/order/{orderId}': {
      get: {
        tags: ['Field Values'],
        summary: 'Get Field Values By Order ID',
        description: 'Returns all field values for a specific order',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Field values fetched successfully' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/api/field-values/{id}': {
      put: {
        tags: ['Field Values'],
        summary: 'Update Field Value',
        description: 'Updates a specific field value record by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  value: { type: 'string', example: 'Updated value' },
                  fieldName: { type: 'string', example: 'Father Name' },
                  bindValue: { type: 'string', example: 'father_s_name' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Field value updated successfully' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Field value not found' },
        },
      },
      delete: {
        tags: ['Field Values'],
        summary: 'Delete Field Value',
        description: 'Deletes a specific field value record by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Field value deleted successfully' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Field value not found' },
        },
      },
    },
    '/api/orders/bulk-update': {
      patch: {
        tags: ['Orders'],
        summary: 'Bulk Update Orders',
        description: 'Updates multiple orders in bulk (Admin only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orderIds', 'updateData'],
                properties: {
                  orderIds: { type: 'array', items: { type: 'string' }, example: ['ORD-1790493446580'] },
                  updateData: { type: 'object', example: { status: 'COMPLETED' } },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Orders updated successfully' },
        },
      },
    },
    '/api/forms/list': {
      get: {
        tags: ['Forms'],
        summary: 'List Active Forms',
        description: 'Returns list of all active forms with Cloudflare KV caching',
        responses: {
          '200': { description: 'List of active forms' },
        },
      },
    },
    '/api/forms/homeForm/latest': {
      get: {
        tags: ['Forms'],
        summary: 'Latest Home Forms',
        description: 'Returns latest home forms list for homepage showcase',
        responses: {
          '200': { description: 'Latest home forms' },
        },
      },
    },
    '/api/forms/state/latest': {
      get: {
        tags: ['Forms'],
        summary: 'Latest Forms By State (All)',
        description: 'Returns paginated list of latest state-level job application forms',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', example: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', example: 8 } },
        ],
        responses: {
          '200': { description: 'Latest forms by state' },
        },
      },
    },
    '/api/forms/state/{state}/latest': {
      get: {
        tags: ['Forms'],
        summary: 'Latest Forms For Specific State',
        description: 'Returns paginated list of latest job application forms for a specific state',
        parameters: [
          { name: 'state', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', example: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', example: 8 } },
        ],
        responses: {
          '200': { description: 'Latest forms for state' },
        },
      },
    },
    '/api/forms/central/latest': {
      get: {
        tags: ['Forms'],
        summary: 'Latest Central Government Forms',
        description: 'Returns paginated list of central government job application forms',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', example: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', example: 8 } },
        ],
        responses: {
          '200': { description: 'Latest central forms' },
        },
      },
    },
    '/api/forms/admin/list': {
      get: {
        tags: ['Forms'],
        summary: 'Admin Forms List (Paginated)',
        description: 'Returns paginated form management directory for Admin users',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', example: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', example: 10 } },
          { name: 'search', in: 'query', schema: { type: 'string', example: 'PAN' } },
          { name: 'status', in: 'query', schema: { type: 'string', example: 'all' } },
        ],
        responses: {
          '200': { description: 'Admin paginated forms' },
          '403': { description: 'Forbidden (Admin role required)' },
        },
      },
    },
    '/api/forms/so/list': {
      get: {
        tags: ['Forms'],
        summary: 'Store Owner Forms List (Paginated)',
        description: 'Returns paginated form directory for Store Owners and Admins',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', example: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', example: 10 } },
        ],
        responses: {
          '200': { description: 'Store owner paginated forms' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/api/forms/create/step-1': {
      post: {
        tags: ['Forms'],
        summary: 'Create Form Step 1',
        description: 'Creates a draft form with basic details and order capabilities (Admin only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['formDetails'],
                properties: {
                  formDetails: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', example: 'PAN Card Application' },
                      short_description: { type: 'string', example: 'Apply for PAN Card' },
                      state: { type: 'string', example: 'Central' },
                      recruitmentboard: { type: 'string', example: 'IT Dept' },
                      last_date: { type: 'string', example: '2026-12-31' },
                      total_vacancy: { type: 'number', example: 100 },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Step 1 complete, draft created' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/api/forms/{id}/step-1': {
      put: {
        tags: ['Forms'],
        summary: 'Update Form Step 1',
        description: 'Updates basic form details and capabilities (Admin only)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Step 1 updated successfully' },
        },
      },
    },
    '/api/forms/{formId}/step-2': {
      post: {
        tags: ['Forms'],
        summary: 'Map Form Inputs Step 2',
        description: 'Saves input field configuration mappings for a form (Admin only)',
        parameters: [
          { name: 'formId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['inputs'],
                properties: {
                  inputs: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        inputDef: { type: 'string', example: '6a018972766f7782490c2968' },
                        required: { type: 'boolean', example: true },
                        order: { type: 'number', example: 1 },
                        isNormal: { type: 'boolean', example: true },
                        ai: { type: 'boolean', example: false },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Inputs mapped successfully' },
        },
      },
    },
    '/api/forms/{id}/step-3': {
      post: {
        tags: ['Forms'],
        summary: 'Publish Form Pricing Step 3',
        description: 'Saves form pricing rules and activates the form (Admin only)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  apply_charges: { type: 'number', example: 92 },
                  discount: { type: 'number', example: 0 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Form published successfully' },
        },
      },
    },
    '/api/forms/formId/{formId}/require-documents': {
      put: {
        tags: ['Forms'],
        summary: 'Update Required Documents By FormId',
        description: 'Updates required document types array by string formId (Admin only)',
        parameters: [
          { name: 'formId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Required documents updated successfully' },
        },
      },
    },
    '/api/forms/{id}/require-documents': {
      put: {
        tags: ['Forms'],
        summary: 'Update Required Documents By ObjectId',
        description: 'Updates required document types array by Mongo ObjectId (Admin only)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Required documents updated successfully' },
        },
      },
    },
    '/api/forms/{formId}/inputs': {
      get: {
        tags: ['Forms'],
        summary: 'Get Form Inputs Configuration',
        description: 'Fetches input field definitions mapped to a form',
        parameters: [
          { name: 'formId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'isNormal', in: 'query', schema: { type: 'string', example: 'true' } },
          { name: 'ai', in: 'query', schema: { type: 'string', example: 'false' } },
        ],
        responses: {
          '200': { description: 'Form input configurations' },
        },
      },
    },
    '/api/forms/{formId}/questions': {
      get: {
        tags: ['Forms'],
        summary: 'Get Form Questions Mapping',
        description: 'Fetches mapped question definitions for a specific form',
        parameters: [
          { name: 'formId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Mapped form questions' },
        },
      },
    },
    '/api/forms/{id}/minimal': {
      get: {
        tags: ['Forms'],
        summary: 'Get Minimal Form Details',
        description: 'Fetches lightweight form details and essential input fields',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Minimal form details' },
        },
      },
    },
    '/api/forms/details/{slugOrId}': {
      get: {
        tags: ['Forms'],
        summary: 'Get Detailed Form Specifications',
        description: 'Fetches form details with query parameters for inputs, pricing, and docs',
        parameters: [
          { name: 'slugOrId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Detailed form specifications' },
        },
      },
    },
    '/api/forms/{slug}': {
      get: {
        tags: ['Forms'],
        summary: 'Get Form By Slug',
        description: 'Fetches form details and flattened input configs by slug',
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Form details' },
        },
      },
    },
    '/api/order-additional-docs': {
      post: {
        tags: ['Order Additional Documents'],
        summary: 'Create Order Additional Document Record(s)',
        description: 'Inserts one or multiple order additional document records for a given order',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['order', 'document'],
                properties: {
                  order: { type: 'string', example: '67c823001e3b6a22ef123456' },
                  document: { type: 'string', example: '67c824001e3b6a22ef654321' },
                  docType: { type: 'string', example: 'signature' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Order additional document record created successfully' },
          '400': { description: 'Bad Request / Missing parameters' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/order-additional-docs/order/{orderId}': {
      get: {
        tags: ['Order Additional Documents'],
        summary: 'Get Additional Documents For Order',
        description: 'Fetches all additional document records mapped to an order',
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'List of additional documents for order' },
          '400': { description: 'Bad Request / Order not found' },
        },
      },
    },
    '/api/order-additional-docs/{id}': {
      delete: {
        tags: ['Order Additional Documents'],
        summary: 'Delete Additional Document Record',
        description: 'Soft-deletes an order additional document record by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Record deleted successfully' },
          '400': { description: 'Bad Request / Record not found' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/store-owners/search': {
      get: {
        tags: ['Store Owners'],
        summary: 'Search subscribed stores',
        parameters: [
          { name: 'formId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Stores matching the form and active subscription' } },
      },
    },
    '/api/store-owners/my-stores': {
      get: {
        tags: ['Store Owners'],
        summary: 'List stores owned by the authenticated user',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Owned stores' }, '401': { description: 'Unauthorized' } },
      },
      post: {
        tags: ['Store Owners'],
        summary: 'Create a store for the authenticated user',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object',
            required: ['storeName', 'displayName', 'contactNumber', 'ownerName'],
            properties: {
              storeName: { type: 'string' }, displayName: { type: 'string' },
              contactNumber: { type: 'string' }, whatsappNumber: { type: 'string' },
              ownerName: { type: 'string' }, storeRef: { type: 'string' }, logo: { type: 'string' },
            },
          } } },
        },
        responses: { '201': { description: 'Store created' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/api/store-owners/my-stores/{storeId}': {
      get: {
        tags: ['Store Owners'], summary: 'Get an owned store', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'storeId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Store details' }, '404': { description: 'Store not found' } },
      },
      patch: {
        tags: ['Store Owners'], summary: 'Update an owned store', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'storeId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '200': { description: 'Store updated' }, '404': { description: 'Store not found' } },
      },
      delete: {
        tags: ['Store Owners'], summary: 'Deactivate an owned store', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'storeId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Store deactivated' }, '404': { description: 'Store not found' } },
      },
    },
    '/api/store-owners/admin/stores': {
      get: {
        tags: ['Store Owners'], summary: 'Admin list of stores', security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'PENDING'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Paginated store list' }, '403': { description: 'Admin role required' } },
      },
    },
    '/api/store-owners/admin/stores/{storeId}': {
      get: {
        tags: ['Store Owners'], summary: 'Admin get any store', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'storeId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Store details including user information' }, '404': { description: 'Store not found' } },
      },
    },
    '/api/store-owners/store-forms': {
      post: {
        tags: ['Store Owners'], summary: 'Associate a form with a store', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', required: ['storeId', 'formId'],
          properties: { storeId: { type: 'string' }, formId: { type: 'string' } },
        } } } },
        responses: { '201': { description: 'Form association created' }, '404': { description: 'Store or form not found' } },
      },
    },
    '/api/store-owners/store-forms/store/{storeId}': {
      get: {
        tags: ['Store Owners'], summary: 'List forms associated with a store',
        description: 'Public endpoint that fetches forms associated with the supplied store ID',
        security: [],
        parameters: [{ name: 'storeId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Paginated forms; an unknown store ID returns an empty list' } },
      },
    },
    '/api/store-owners/store-forms/{id}/toggle': {
      patch: {
        tags: ['Store Owners'], summary: 'Set store-form active status', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', required: ['isActive'], properties: { isActive: { type: 'boolean' } },
        } } } },
        responses: { '200': { description: 'Mapping updated' }, '404': { description: 'Mapping not found' } },
      },
    },
    '/api/store-owners/store-forms/{id}': {
      delete: {
        tags: ['Store Owners'], summary: 'Remove a store-form association', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Mapping removed' }, '404': { description: 'Mapping not found' } },
      },
    },
    '/api/store-owners/store-subscriptions/plans': {
      get: { tags: ['Store Owners'], summary: 'List active subscription plans', responses: { '200': { description: 'Active plans' } } },
    },
    '/api/store-owners/store-subscriptions/my-subscription/{storeId}': {
      get: {
        tags: ['Store Owners'], summary: 'Get a store subscription', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'storeId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Current subscription' }, '404': { description: 'Store not found' } },
      },
    },
    '/api/store-owners/store-subscriptions/subscribe': {
      post: {
        tags: ['Store Owners'], summary: 'Create a pending store subscription', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', required: ['storeId', 'planId'],
          properties: { storeId: { type: 'string' }, planId: { type: 'string' } },
        } } } },
        responses: { '201': { description: 'Pending subscription created' }, '409': { description: 'Store already has a valid plan' } },
      },
    },
    '/api/payments/create': {
      post: {
        tags: ['Payments'],
        summary: 'Initiate Payment Order',
        description: 'Initiates a Cashfree payment order for an existing order ID',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['order'],
                properties: {
                  order: { type: 'string', example: 'ORD-100234 or 67c823001e3b6a22ef123456' },
                  isSandbox: { type: 'boolean', example: false },
                  return_url: { type: 'string', example: 'https://www.brinto.in/payment-status' },
                  order_note: { type: 'string', example: 'Payment for order ORD-100234' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Payment order initiated successfully' },
          '400': { description: 'Bad Request / Order already paid or not found' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/payments/webhook': {
      post: {
        tags: ['Payments'],
        summary: 'Payment Webhook Verification',
        description: 'Verifies payment transaction status from Cashfree webhook/callback',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  transactionId: { type: 'string', example: 'order_123456789' },
                  isSandbox: { type: 'boolean', example: false },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Payment status verified successfully' },
          '400': { description: 'Bad request / Transaction not found' },
        },
      },
    },
    '/api/payments/webhook/{transactionId}': {
      post: {
        tags: ['Payments'],
        summary: 'Payment Webhook Verification by Path Parameter',
        description: 'Verifies payment transaction status from Cashfree by URL parameter',
        parameters: [
          { name: 'transactionId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'isSandbox', in: 'query', schema: { type: 'boolean', example: false } },
        ],
        responses: {
          '200': { description: 'Payment status verified successfully' },
          '400': { description: 'Bad request / Transaction not found' },
        },
      },
    },
  },
};
