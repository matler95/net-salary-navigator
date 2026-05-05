
-- Create table for retirement limits
CREATE TABLE IF NOT EXISTS public.retirement_limits (
    year INTEGER PRIMARY KEY,
    ike_limit NUMERIC NOT NULL,
    ikze_limit NUMERIC NOT NULL,
    ikze_b2b_limit NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.retirement_limits ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access for retirement limits"
ON public.retirement_limits FOR SELECT
TO public
USING (true);

-- Allow authenticated users to update (admin-like, but for now just auth)
CREATE POLICY "Allow authenticated users to update retirement limits"
ON public.retirement_limits FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Insert default data
INSERT INTO public.retirement_limits (year, ike_limit, ikze_limit, ikze_b2b_limit)
VALUES 
    (2024, 23472, 9388, 14083.2),
    (2025, 26019, 10407.6, 15611.4)
ON CONFLICT (year) DO UPDATE SET
    ike_limit = EXCLUDED.ike_limit,
    ikze_limit = EXCLUDED.ikze_limit,
    ikze_b2b_limit = EXCLUDED.ikze_b2b_limit;
