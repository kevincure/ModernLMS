-- Extend cleanup_expired_lti_tokens() to also clean up expired login hints
CREATE OR REPLACE FUNCTION public.cleanup_expired_lti_tokens()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted integer := 0;
  d integer;
BEGIN
  DELETE FROM public.lti_state_nonce WHERE expires_at < now() - interval '1 hour';
  GET DIAGNOSTICS d = ROW_COUNT;
  deleted := deleted + d;

  DELETE FROM public.lti_client_assertion_jti WHERE expires_at < now();
  GET DIAGNOSTICS d = ROW_COUNT;
  deleted := deleted + d;

  DELETE FROM public.lti_login_hints WHERE expires_at < now() - interval '1 hour';
  GET DIAGNOSTICS d = ROW_COUNT;
  deleted := deleted + d;

  RETURN deleted;
END;
$$;
