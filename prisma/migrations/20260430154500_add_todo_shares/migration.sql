-- Add shared access for user-specific todos.
CREATE TABLE "TodoShare" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "todoId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TodoShare_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TodoShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TodoShare_todoId_userId_key" ON "TodoShare"("todoId", "userId");
CREATE INDEX "TodoShare_userId_createdAt_idx" ON "TodoShare"("userId", "createdAt");
