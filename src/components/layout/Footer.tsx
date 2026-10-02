import Link from "next/link";
import { Phone, Mail, MapPin, Award, ShieldCheck, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-forest-950 text-slate-400 border-t border-forest-900 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-forest-900/80">
          {/* Col 1: Brand & Award */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-forest-950 shadow-glow font-bold text-xl">
                VC
              </div>
              <span className="font-display font-bold text-2xl tracking-wider text-white">
                VISTA CHASE
              </span>
            </Link>
            <p className="text-sm text-slate-300 leading-relaxed pr-6">
              Banff and the Canadian Rockies top-rated tour operator since 2018. Proudly recognized in TripAdvisor&apos;s 2025 Travelers&apos; Choice Best of the Best Awards, ranked <strong>#6 Experience in Canada</strong>.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-forest-900/90 border border-gold-400/20 text-gold-300 text-xs font-semibold">
              <Award className="w-4 h-4 text-gold-400" />
              <span>TripAdvisor Best of the Best 2025 • Top 1% Worldwide</span>
            </div>
          </div>

          {/* Col 2: Tours & Shuttles */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Experiences</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/shuttles" className="hover:text-gold-400 transition-colors">
                  Moraine Lake Shuttles
                </Link>
              </li>
              <li>
                <Link href="/banff-highlights-tour" className="hover:text-gold-400 transition-colors">
                  Banff Highlights Tour (#6)
                </Link>
              </li>
              <li>
                <Link href="/private-tours" className="hover:text-gold-400 transition-colors">
                  Private SUV Tours
                </Link>
              </li>
              <li>
                <Link href="/banff-yoho-custom-private-tour" className="hover:text-gold-400 transition-colors">
                  Yoho &amp; Emerald Lake Tour
                </Link>
              </li>
              <li>
                <Link href="/icefields-jasper-private-tour" className="hover:text-gold-400 transition-colors">
                  Icefields Parkway &amp; Jasper
                </Link>
              </li>
              <li>
                <Link href="/multi-day-tour-package-for-banff" className="hover:text-gold-400 transition-colors">
                  3-Day Luxury Packages
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Destinations & Tools */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Destinations &amp; Tools</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/destinations/moraine-lake" className="hover:text-gold-400 transition-colors">
                  Moraine Lake Access
                </Link>
              </li>
              <li>
                <Link href="/destinations/lake-louise" className="hover:text-gold-400 transition-colors">
                  Lake Louise
                </Link>
              </li>
              <li>
                <Link href="/destinations/banff-national-park" className="hover:text-gold-400 transition-colors">
                  Banff National Park
                </Link>
              </li>
              <li>
                <Link href="/destinations/jasper-national-park" className="hover:text-gold-400 transition-colors">
                  Jasper National Park
                </Link>
              </li>
              <li>
                <Link href="/pickup-finder" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                  Hotel Pickup Finder
                </Link>
              </li>
              <li>
                <Link href="/concierge" className="text-gold-400 hover:text-gold-300 font-medium transition-colors">
                  AI Voice Concierge
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact & Base */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Headquarters</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                <span>121 Bow Meadows Crescent #110, Canmore, AB T1W 2W8, Canada</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-gold-400 shrink-0" />
                <a href="tel:+18257349456" className="hover:text-white transition-colors">
                  +1 (825) 734-9456
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-gold-400 shrink-0" />
                <a href="mailto:info@vistachase.com" className="hover:text-white transition-colors">
                  info@vistachase.com
                </a>
              </li>
              <li className="pt-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Parks Canada Licensed Commercial Operator
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} Vista Chase Tours Ltd. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/terms-and-conditions" className="hover:text-slate-200 transition-colors">
              Terms &amp; Conditions
            </Link>
            <Link href="/privacy-policy" className="hover:text-slate-200 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/faq" className="hover:text-slate-200 transition-colors">
              FAQ &amp; Cancellation
            </Link>
            <Link href="/admin" className="hover:text-gold-400 transition-colors">
              Staff Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
