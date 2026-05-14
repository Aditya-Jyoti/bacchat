import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Static cheat-sheet, reachable from the `?` icon in any main screen.
/// Covers: what splits/groups/budgets/SMS auto-import do, how the per-merchant
/// category memory works, the meanings of the group-card states, the
/// Android-13 "restricted settings" SMS permission step, and how to enable
/// real-time SMS auto-import.
class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text('How Bacchat works',
            style: GoogleFonts.montserrat(fontWeight: FontWeight.w800)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        children: [
          _section('Two kinds of money', scheme, children: [
            _para(
              'Bacchat keeps personal money and shared money in separate places.',
              scheme,
            ),
            _bullet(
              'Personal: your transactions, budget, categories. Lives only on '
              'your phone — never on the server.',
              scheme,
            ),
            _bullet(
              'Shared: split groups + shares + balances. Lives on the server '
              'because more than one person needs to see it.',
              scheme,
            ),
          ]),

          _section('Starting a split', scheme, children: [
            _para('From the Splits tab, tap "Split with…":', scheme),
            _bullet(
              '"Someone already on Bacchat" — scan their QR (Profile → Your '
              'Bacchat ID) or paste their ID. A 1-on-1 group is created '
              'automatically, named "You & their-name".',
              scheme,
            ),
            _bullet(
              '"A new group" — for trips, flatmates, or any multi-person '
              'expense set. You can add members later.',
              scheme,
            ),
            _bullet(
              'A friend who isn\'t on Bacchat yet? Open a group, then '
              'Group info → Members → "Add by name". You get a one-time '
              'claim link to send them. They can install Bacchat any time '
              'later and inherit every split you added under their name.',
              scheme,
            ),
          ]),

          _section('What the group card states mean', scheme, children: [
            _bullet(
              '"No splits yet" — zero splits in the group. Tap to add the first.',
              scheme,
            ),
            _bullet(
              '"N splits · You\'re square" — splits exist; you happen to have '
              'no outstanding balance (either because everything is settled, '
              'or because no unsettled share involves you).',
              scheme,
            ),
            _bullet(
              '"You get ₹X" — others owe you that much, net, in this group.',
              scheme,
            ),
            _bullet(
              '"You pay ₹X" — you owe that much, net, in this group.',
              scheme,
            ),
          ]),

          _section('Settling debts', scheme, children: [
            _para(
              'Only the debtor or the payer can mark a share as settled — '
              'admins-who-are-not-either can\'t overreach.',
              scheme,
            ),
            _bullet(
              'Open a split → tap the radio next to a share. Visible to '
              'the share\'s debtor or the split\'s payer.',
              scheme,
            ),
            _bullet(
              '"Settle all" in a split — payer only, one tap clears every '
              'unsettled share at once.',
              scheme,
            ),
            _bullet(
              '"Settle" button on the Balance screen — collapses every '
              'unsettled debt between two members into a single action.',
              scheme,
            ),
          ]),

          _section('Bills with multiple items (OCR scan)', scheme, children: [
            _para(
              'Inside a group → Add Split → tap the scanner icon. Take a '
              'photo of the bill or pick from gallery.',
              scheme,
            ),
            _bullet(
              'Each line item can be paid by everyone, by one person, or '
              'by any subset (e.g. 3 of 5). The "Who" column opens a '
              'multi-select picker.',
              scheme,
            ),
            _bullet(
              'Numbers, qty, and names are all editable post-scan. Bad OCR '
              'lines can be deleted; missing rows can be added.',
              scheme,
            ),
          ]),

          _section('Personal transactions + budget', scheme, children: [
            _bullet(
              'Set a monthly income, savings goal, and category limits from '
              'the Budget screen.',
              scheme,
            ),
            _bullet(
              'Add a transaction manually from the Activity tab. Pick a '
              'category, or tap "+ New category" to create one inline.',
              scheme,
            ),
            _bullet(
              'Each transaction can carry a "Vendor" / payee name. Flipping '
              'the "Always categorise X" toggle remembers it for that '
              'vendor — every future entry to the same payee auto-tags.',
              scheme,
            ),
          ]),

          _section('SMS auto-import', scheme, children: [
            _para(
              'Bacchat reads bank transaction SMS in real time (foreground, '
              'background, or after the app is force-stopped) and creates '
              'a personal transaction without any user action.',
              scheme,
            ),
            _bullet(
              'Supported senders: SBI, HDFC, ICICI, Axis, Yes Bank, '
              'Kotak, IDFC, BoB, Federal, AU, RBL, PNB, Canara, Union, '
              'Indian Bank, BoI, IDBI, plus Paytm / GPay / PhonePe / '
              'Amazon Pay / BHIM SMSes.',
              scheme,
            ),
            _bullet(
              'Duplicate-proof: two SMS for the same payment (e.g. bank + '
              'an expense-tracker app like Axio) collapse into one row.',
              scheme,
            ),
            _bullet(
              'No bank data leaves your phone. Parsing and storage are '
              'entirely on-device.',
              scheme,
            ),
            const SizedBox(height: 6),
            _calloutBox(
              'On Android 13+, SMS permission is greyed-out for any '
              'sideloaded app until you enable "Restricted settings". '
              'A walkthrough appears as a banner on the home screen — tap '
              'it for the exact 4-step path.',
              scheme,
            ),
          ]),

          _section('Privacy + security at a glance', scheme, children: [
            _bullet(
              'Personal transactions, budget, categories, merchant mappings '
              '→ on-device SQLite (encrypted by the OS sandbox). No server '
              'storage.',
              scheme,
            ),
            _bullet(
              'Auth tokens → Android Keystore (flutter_secure_storage). Not '
              'in plain-text SharedPreferences.',
              scheme,
            ),
            _bullet(
              'Group data is the only thing on the server — that\'s the '
              'minimum to make sharing work.',
              scheme,
            ),
          ]),
        ],
      ),
    );
  }

  Widget _section(String title, ColorScheme scheme, {required List<Widget> children}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title.toUpperCase(),
            style: GoogleFonts.montserrat(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: scheme.primary,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 10),
          ...children,
        ],
      ),
    );
  }

  Widget _para(String text, ColorScheme scheme) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: GoogleFonts.montserrat(
          fontSize: 13,
          color: scheme.onSurface,
          height: 1.55,
        ),
      ),
    );
  }

  Widget _bullet(String text, ColorScheme scheme) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, left: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 7, right: 10),
            child: Container(
              width: 5,
              height: 5,
              decoration: BoxDecoration(
                color: scheme.primary,
                shape: BoxShape.circle,
              ),
            ),
          ),
          Expanded(
            child: Text(
              text,
              style: GoogleFonts.montserrat(
                fontSize: 13,
                color: scheme.onSurface,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _calloutBox(String text, ColorScheme scheme) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: scheme.tertiaryContainer,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.shield_outlined,
              size: 16, color: scheme.onTertiaryContainer),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: GoogleFonts.montserrat(
                fontSize: 12,
                color: scheme.onTertiaryContainer,
                height: 1.45,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
