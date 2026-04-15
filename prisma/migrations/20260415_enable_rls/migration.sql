-- Enable Row Level Security on users table
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can only read their own data
CREATE POLICY "Users can view own profile"
ON "User"
FOR SELECT
USING (auth.uid()::text = id);

-- Policy 2: Users can only update their own data
CREATE POLICY "Users can update own profile"
ON "User"
FOR UPDATE
USING (auth.uid()::text = id);

-- Policy 3: Allow service role (backend) full access
CREATE POLICY "Service role has full access"
ON "User"
FOR ALL
USING (auth.role() = 'service_role');

-- Policy 4: Allow authenticated users to insert (for signup)
CREATE POLICY "Authenticated users can insert"
ON "User"
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');
