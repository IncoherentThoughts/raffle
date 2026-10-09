-- Duplicate Flag rules (#7), one assertion per rule clause, positive and
-- negative cases. 04_entries_flags_test.sql covers dismissal, the admin
-- Entries view and the Snapshot; this file pins the matching rules.
begin;
\ir _helpers.psql
select plan(27);

-- Normalization functions ------------------------------------------------------------
-- Same name: trim, collapse whitespace, lowercase, strip diacritics and punctuation.
select is(private.flag_name('  Ana   DIAZ  '), 'ana diaz', 'name: trims, collapses whitespace, lowercases');
select is(private.flag_name('Zoë Ångström'), 'zoe angstrom', 'name: strips diacritics');
select is(private.flag_name('Mary-Jane O''Neil, Jr.'), 'maryjane oneil jr', 'name: strips punctuation');
select is(private.flag_name('...'), '', 'name: punctuation only normalizes to empty');

-- Email match: +tag and local-part dots stripped, company domains folded.
select is(private.flag_email('  Pat+Raffle@Gmail.com '), 'pat@gmail.com', 'email: trims, lowercases, strips +tag');
select is(private.flag_email('p.a.t@gmail.com'), 'pat@gmail.com', 'email: strips dots in the local part');
select is(private.flag_email('dan@mail.example.com'), 'dan@mail.example.com', 'email: keeps dots in the domain');
select is(private.flag_email('lee@automatedcontrolsinc.com'), private.flag_email('lee@thecomfortgroup.com'),
  'email: automatedcontrolsinc.com = thecomfortgroup.com');
select isnt(private.flag_email('max@gmail.com'), private.flag_email('max@yahoo.com'),
  'email: other domains are not folded together');
select isnt(private.flag_email('chris@thecomfortgroup.com'), private.flag_email('chris@gmail.com'),
  'email: a personal address does not match the company address');

-- Fixtures ---------------------------------------------------------------------------
-- An earlier Raffle with lookalikes of Entries below: never flagged across Raffles.
select tests.remember('other', tests.make_raffle(p_title => 'Earlier', p_state => 'cancelled',
  p_created_at => now() - interval '60 days', p_close_time => now() - interval '50 days'));
select tests.make_entry(tests.id('other'), 'Uma Solo', 'uma@example.com', 'x2');
select tests.make_entry(tests.id('other'), 'Vic Solo', 'v.i.c+old@example.com');

select tests.remember('r', tests.make_raffle(p_title => '#14 flag rules', p_close_time => now() + interval '1 day'));
-- same name
select tests.remember('ana1', tests.make_entry(tests.id('r'), '  ANA   diaz ', 'ana1@example.com'));
select tests.remember('ana2', tests.make_entry(tests.id('r'), 'ana diaz', 'ana2@example.org'));
select tests.remember('zoe1', tests.make_entry(tests.id('r'), 'Zoë Ångström', 'zoe@example.com'));
select tests.remember('zoe2', tests.make_entry(tests.id('r'), 'Zoe Angstrom', 'zangstrom@example.com'));
select tests.remember('mj1', tests.make_entry(tests.id('r'), 'Mary-Jane O''Neil', 'mj@example.com'));
select tests.remember('mj2', tests.make_entry(tests.id('r'), 'MaryJane ONeil', 'mjoneil@example.com'));
select tests.remember('jon', tests.make_entry(tests.id('r'), 'Jon Smith', 'jon@example.com'));
select tests.remember('john', tests.make_entry(tests.id('r'), 'John Smith', 'john@example.com'));
select tests.remember('bob', tests.make_entry(tests.id('r'), 'Bob Stone', 'bob@example.com'));
select tests.remember('robert', tests.make_entry(tests.id('r'), 'Robert Stone', 'robert@example.com'));
select tests.remember('dots', tests.make_entry(tests.id('r'), '...', 'dots@example.com'));
select tests.remember('bang', tests.make_entry(tests.id('r'), '!!!', 'bang@example.com'));
-- email match
select tests.remember('pat1', tests.make_entry(tests.id('r'), 'Pat One', 'pat+raffle@gmail.com'));
select tests.remember('pat2', tests.make_entry(tests.id('r'), 'Pat Two', 'pat@gmail.com'));
select tests.remember('lou1', tests.make_entry(tests.id('r'), 'Lou One', 'l.o.u@gmail.com'));
select tests.remember('lou2', tests.make_entry(tests.id('r'), 'Lou Two', 'lou@gmail.com'));
select tests.remember('lee1', tests.make_entry(tests.id('r'), 'Lee One', 'lee@automatedcontrolsinc.com'));
select tests.remember('lee2', tests.make_entry(tests.id('r'), 'Lee Two', 'lee@thecomfortgroup.com'));
select tests.remember('tia1', tests.make_entry(tests.id('r'), 'Tia One', 'T.i.a+x@AutomatedControlsInc.com'));
select tests.remember('tia2', tests.make_entry(tests.id('r'), 'Tia Two', 'tia@thecomfortgroup.com'));
select tests.remember('max1', tests.make_entry(tests.id('r'), 'Max One', 'max@gmail.com'));
select tests.remember('max2', tests.make_entry(tests.id('r'), 'Max Two', 'max@yahoo.com'));
select tests.remember('chris1', tests.make_entry(tests.id('r'), 'Chris One', 'chris@thecomfortgroup.com'));
select tests.remember('chris2', tests.make_entry(tests.id('r'), 'Chris Two', 'chris@gmail.com'));
select tests.remember('dan1', tests.make_entry(tests.id('r'), 'Dan One', 'dan@mail.example.com'));
select tests.remember('dan2', tests.make_entry(tests.id('r'), 'Dan Two', 'dan@mailexample.com'));
-- same device (every Entry above has no device_id)
select tests.remember('deva', tests.make_entry(tests.id('r'), 'Dev A', 'deva@example.com', 'x1'));
select tests.remember('devb', tests.make_entry(tests.id('r'), 'Dev B', 'devb@example.com', 'x1'));
select tests.remember('devc', tests.make_entry(tests.id('r'), 'Dev C', 'devc@example.com', 'x1', p_removed => true));
-- lookalikes of the earlier Raffle's Entries
select tests.remember('uma', tests.make_entry(tests.id('r'), 'Uma Other', 'uma.other@example.com', 'x2'));
select tests.remember('uma_same', tests.make_entry(tests.id('r'), 'Uma Solo', 'uma.solo@example.com'));
select tests.remember('vic', tests.make_entry(tests.id('r'), 'Vic Here', 'vic@example.com'));

-- Pairs as (key, key) with the keys in order, per rule.
create function tests.pairs(p_rule text) returns table (a text, b text) language sql as $$
  select ka.name, kb.name
    from public.admin_entry_flags(tests.id('r')) f
    join tests.ids ka on ka.id = f.entry_id
    join tests.ids kb on kb.id = f.other_entry_id
   where f.rule::text = p_rule and ka.name < kb.name
$$;
grant execute on function tests.pairs(text) to authenticated;

select tests.as_admin();

-- Same name ---------------------------------------------------------------------------
select set_eq($$ select * from tests.pairs('same_name') $$,
  $$ values ('ana1', 'ana2'), ('zoe1', 'zoe2'), ('mj1', 'mj2') $$,
  'same name: exactly the pairs equal after normalization');
select is((select count(*)::int from tests.pairs('same_name') where a in ('ana1') or b in ('ana2')), 1,
  'same name: case and spacing differences match');
select is((select count(*)::int from tests.pairs('same_name') where (a, b) = ('zoe1', 'zoe2')), 1,
  'same name: diacritics differences match');
select is((select count(*)::int from tests.pairs('same_name') where (a, b) = ('mj1', 'mj2')), 1,
  'same name: punctuation differences match');
select is((select count(*)::int from tests.pairs('same_name') where a in ('jon', 'john', 'bob', 'robert')
                                                              or b in ('jon', 'john', 'bob', 'robert')), 0,
  'same name: no fuzzy matching and no nickname table');
select is((select count(*)::int from tests.pairs('same_name') where 'dots' in (a, b) or 'bang' in (a, b)), 0,
  'same name: names that normalize to empty never match');

-- Email match -------------------------------------------------------------------------
select set_eq($$ select * from tests.pairs('email_match') $$,
  $$ values ('pat1', 'pat2'), ('lou1', 'lou2'), ('lee1', 'lee2'), ('tia1', 'tia2') $$,
  'email match: exactly +tag, local-part dots and company-domain pairs');
select is((select count(*)::int from tests.pairs('email_match')
            where 'max1' in (a, b) or 'chris1' in (a, b) or 'dan1' in (a, b)), 0,
  'email match: other domains, personal vs company and domain dots never match');

-- Same device -------------------------------------------------------------------------
select set_eq($$ select * from tests.pairs('same_device') $$,
  $$ values ('deva', 'devb'), ('devb', 'devc'), ('deva', 'devc') $$,
  'same device: every pair sharing a device_id (removed Entries included); no device_id never matches');

-- Scope -------------------------------------------------------------------------------
select is((select count(*)::int from public.admin_entry_flags(tests.id('r')) f
            where f.entry_id in (tests.id('uma'), tests.id('uma_same'), tests.id('vic'))), 0,
  'scope: name, email and device matches in another Raffle are not flagged');
select is((select count(*)::int from public.admin_entry_flags(tests.id('other'))), 0,
  'scope: the earlier Raffle is not flagged against this one');

-- Dismissal and "pair removed" ----------------------------------------------------------
select lives_ok(format($$select public.dismiss_flag(%L, 'same_device', %L, %L, 'shared laptop')$$,
                       tests.id('r'), tests.id('deva'), tests.id('devb')),
  'dismiss one same-device pair');
select set_eq(
  $$ select k.name, flags::text[] from public.admin_entries(tests.id('r')) e
       join tests.ids k on k.id = e.id where k.name in ('deva', 'devb', 'devc') $$,
  $$ values ('deva', array['same_device']), ('devb', array['same_device']), ('devc', array['same_device']) $$,
  'dismissal is per pair: other pairs of the group still flag each Entry');
select is((select bool_and(other_removed) from public.admin_entry_flags(tests.id('r'))
            where other_entry_id = tests.id('devc')), true,
  'a pair whose other Entry is removed reports other_removed (grey "pair removed" pill)');
select throws_ok(format($$select public.dismiss_flag(%L, 'same_device', %L, %L, 'wrong raffle')$$,
                        tests.id('other'), tests.id('deva'), tests.id('devc')),
  '22023', 'not_flagged', 'a pair can only be dismissed in its own Raffle');
select is((select count(*)::int from public.flag_dismissals where raffle_id = tests.id('r')), 1,
  'exactly one dismissal row was written');
select is((select count(*)::int from public.admin_entry_flags(tests.id('r')) where dismissed), 2,
  'the dismissed pair reads as dismissed from both sides only');

select * from finish();
rollback;
