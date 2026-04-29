import { RealEstateProvider } from "./context";
import { ScenarioHeader } from "./zone1";
import { InputPanel } from "./zone2";
import { InsightPanel } from "./zone3";
import { MobileWizard } from "./mobile-wizard";

export function RealEstateCalculatorV2() {
  return (
    <RealEstateProvider>
      {/* Desktop 3-Zone Layout */}
      <div className="hidden md:block">
        <ScenarioHeader />
        <div className="grid grid-cols-[380px,1fr] xl:grid-cols-[420px,1fr] gap-8 items-start">
          <InputPanel />
          <InsightPanel />
        </div>
      </div>

      {/* Mobile Step Wizard Layout */}
      <div className="block md:hidden -mx-4 sm:-mx-6 -mt-6">
        <MobileWizard />
      </div>
    </RealEstateProvider>
  );
}
