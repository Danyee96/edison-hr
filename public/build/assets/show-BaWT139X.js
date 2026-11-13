import{r as h,j as e}from"./ui-ZNezDwJH.js";import{P as O}from"./page-template-DHdsv9bG.js";import{u as W,c as G,r as J,C as p,v as m,w as u,q as x,B as K,an as Q}from"./app-ClL7rqSJ.js";import{A as V}from"./arrow-left-DKPj6ETA.js";import{P as X}from"./printer-CFNmTRra.js";import{D as C}from"./download-lAfyRvId.js";import{U as Y}from"./users-BTiwQsjf.js";import{D as b}from"./dollar-sign-D-fG35LD.js";import"./textarea-BaWsqArj.js";import"./select-qDFrWgJL.js";import"./index-BdQq_4o_.js";import"./index-DTCOoIo4.js";import"./chevron-up-DCa0LfOq.js";import"./react-country-flag.esm-qk2vEKSA.js";import"./language-BbwPiY59.js";import"./sparkles-3D5PChUm.js";import"./loader-circle-Ba8s_U00.js";import"./copy-okEaxYVf.js";import"./CookieConsentBanner-BGERioKM.js";import"./switch-DZgxoAad.js";import"./chevron-right-TxM6h4hZ.js";import"./clock-CAE3lsXR.js";import"./credit-card-Kn9DezBJ.js";import"./settings-DF5-U4ZV.js";import"./chart-no-axes-column-increasing-Btnj5XVX.js";import"./user-D7nRoDfX.js";import"./use-favicon-65nyF1dd.js";import"./use-brand-theme-X7yOaGBH.js";/* empty css            *//* empty css                  */import"./utils-CkqlEBwS.js";function Me(){var v,k,S,D,L,P,M;const{t:l}=W(),{payrollRun:r,holidayExclusions:j=[]}=G().props,d=h.useRef(null),c=t=>Math.round(Number(t||0)).toLocaleString("en-US"),f=t=>{const a=Math.round(Number(t||0));return a>0?`-${a.toLocaleString("en-US")}`:"0"},T=t=>Q(t)||"-",A=t=>{const a=Number(t||0);if(a<=0)return"0m";const o=Math.floor(a/60),s=a%60;return o>0?`${o}h ${s}m`:`${s}m`},z=t=>{const a=Number(t||0);return Number.isInteger(a)?String(a):a.toFixed(2)},R=t=>{var a,o,s,n;return((a=t.employee)==null?void 0:a.name)||((s=(o=t.employee)==null?void 0:o.employee)==null?void 0:s.name)||((n=t.employee)==null?void 0:n.full_name)||"-"},F=t=>{var a,o,s,n,i;return((s=(o=(a=t.employee)==null?void 0:a.employee)==null?void 0:o.department)==null?void 0:s.name)||((i=(n=t.employee)==null?void 0:n.department)==null?void 0:i.name)||"-"},w=t=>{var a;return Number(((a=t.deductions_breakdown)==null?void 0:a["Manual Fine Amount"])||0)},N=t=>{var s;const a=Number(((s=t.deductions_breakdown)==null?void 0:s["Partial Attendance Hours"])||0),o=w(t);return a>0&&Number(t.other_deductions||0)>o},B=t=>{var s,n;const a=Number(((s=t.deductions_breakdown)==null?void 0:s["Late Minutes"])||0),o=Number(((n=t.deductions_breakdown)==null?void 0:n["Partial Attendance Hours"])||0);return N(t)?a+o*60:a},$=t=>{var s;const a=Number(t.late_penalty||0),o=Number(((s=t.deductions_breakdown)==null?void 0:s["Partial Attendance Penalty"])||0);return N(t)?a+o:a},H=r.payroll_entries||[],_=()=>{window.open(route("hr.payroll-runs.download-pdf",r.id),"_blank")},y=h.useCallback(()=>{const t=document.documentElement,a=document.body,o=t.classList.contains("dark"),s=a.classList.contains("dark");d.current&&window.clearTimeout(d.current);const n=()=>{t.classList.remove("payroll-printing"),a.classList.remove("payroll-printing"),t.style.colorScheme="",a.style.colorScheme="",t.classList.toggle("dark",o),a.classList.toggle("dark",s),window.removeEventListener("afterprint",i),window.removeEventListener("focus",i),d.current=null},i=()=>{d.current&&window.clearTimeout(d.current),d.current=window.setTimeout(n,350)};t.classList.add("payroll-printing"),a.classList.add("payroll-printing"),t.classList.remove("dark"),a.classList.remove("dark"),t.style.colorScheme="light",a.style.colorScheme="light",window.addEventListener("afterprint",i,{once:!0}),window.addEventListener("focus",i,{once:!0}),window.setTimeout(()=>{window.print()},50)},[]);h.useEffect(()=>()=>{d.current&&window.clearTimeout(d.current)},[]),h.useEffect(()=>{new URLSearchParams(window.location.search).get("print")==="1"&&window.setTimeout(y,500)},[y]);const U=[{title:l("Dashboard"),href:route("dashboard")},{title:l("Payroll Management"),href:route("hr.payroll-runs.index")},{title:l("Payroll Runs"),href:route("hr.payroll-runs.index")},{title:r.title}],g=[{label:l("Back to List"),icon:e.jsx(V,{className:"h-4 w-4 mr-2"}),variant:"outline",onClick:()=>J.get(route("hr.payroll-runs.index"))}];r.status==="completed"&&(g.unshift({label:l("Print"),icon:e.jsx(X,{className:"h-4 w-4 mr-2"}),variant:"default",onClick:y}),g.unshift({label:l("Download Payroll"),icon:e.jsx(C,{className:"h-4 w-4 mr-2"}),variant:"outline",onClick:_}));const q=t=>{const a={draft:"bg-gray-50 text-gray-700 ring-gray-600/20",processing:"bg-yellow-50 text-yellow-700 ring-yellow-600/20",completed:"bg-green-50 text-green-700 ring-green-600/20",cancelled:"bg-red-50 text-red-700 ring-red-600/20"};return a[t]||a.draft};return e.jsxs(O,{title:r.title,url:`/hr/payroll-runs/${r.id}`,actions:g,breadcrumbs:U,children:[e.jsx("style",{children:`
        html.payroll-printing,
        body.payroll-printing {
          background: #ffffff !important;
          color: #111827 !important;
          color-scheme: light !important;
        }
        html.payroll-printing [data-slot="sidebar-inset"],
        html.payroll-printing main {
          background: #ffffff !important;
          color: #111827 !important;
        }
        .payroll-entries-card,
        .payroll-entries-card [data-slot="card"],
        .payroll-entries-card [data-slot="card-content"],
        .payroll-entries-card > div,
        .payroll-entries-card table,
        .payroll-entries-card thead,
        .payroll-entries-card tbody,
        .payroll-entries-card tr,
        .payroll-entries-card th,
        .payroll-entries-card td,
        html.payroll-printing .payroll-entries-card,
        html.payroll-printing .payroll-entries-card [data-slot="card"],
        html.payroll-printing .payroll-entries-card [data-slot="card-content"],
        html.payroll-printing .payroll-entries-card > div,
        html.payroll-printing .payroll-entries-card table,
        html.payroll-printing .payroll-entries-card thead,
        html.payroll-printing .payroll-entries-card tbody,
        html.payroll-printing .payroll-entries-card tr,
        html.payroll-printing .payroll-entries-card th,
        html.payroll-printing .payroll-entries-card td {
          background-color: #ffffff !important;
          color-scheme: light !important;
        }
        .payroll-entries-card thead tr,
        html.payroll-printing .payroll-entries-card thead tr {
          background-color: #f8fafc !important;
        }
        .payroll-slip-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 1024px) {
          .payroll-slip-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        .payroll-slip {
          break-inside: avoid;
          page-break-inside: avoid;
          overflow: hidden;
          border: 1px dashed #94a3b8;
          border-radius: 8px;
          background: #ffffff;
          padding: 10px;
        }
        .payroll-slip-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
          overflow: hidden;
          border: 2px solid #111827;
          font-size: 15px;
          color: #111827;
        }
        .payroll-slip-table th,
        .payroll-slip-table td {
          border: 1px solid #111827;
          padding: 8px 10px;
          vertical-align: middle;
        }
        .payroll-slip-table th {
          background: #ffffff;
          color: #111827;
          text-align: center;
          font-weight: 800;
        }
        .payroll-slip-table .payroll-slip-employee {
          background: #ffffff;
          color: #050505;
          text-transform: uppercase;
          letter-spacing: 0;
          font-size: 24px;
          line-height: 1.15;
          padding: 18px 10px;
        }
        .payroll-slip-table .payroll-slip-total-head {
          background: #ffffff;
          color: #050505;
          font-size: 18px;
          line-height: 1.2;
        }
        .payroll-slip-table .payroll-slip-total-head span {
          display: block;
          color: #22c55e;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          font-size: 16px;
          font-weight: 900;
        }
        .payroll-slip-table .payroll-slip-meta td {
          background: #f8fafc;
          color: #475569;
          font-size: 13px;
          font-weight: 700;
          text-align: center;
        }
        .payroll-slip-table td:first-child {
          width: 34%;
          font-weight: 800;
          text-align: center;
        }
        .payroll-slip-table td:nth-child(2) {
          width: 36%;
          text-align: center;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          color: #374151;
          font-size: 15px;
        }
        .payroll-slip-table .amount {
          width: 30%;
          text-align: center;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          font-weight: 800;
          font-size: 15px;
          color: #111827;
        }
        .payroll-slip-table .danger {
          color: #dc2626;
        }
        .payroll-slip-table .success {
          color: #16a34a;
        }
        .payroll-slip-total td {
          background: #050505;
          color: #ffffff !important;
          font-size: 17px;
          font-weight: 900;
          text-align: center;
        }
        .payroll-slip-total td:last-child {
          background: #12b85f;
          color: #ffffff !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        }
        @media print {
          html, body, #app, main, [data-slot="sidebar-inset"] {
            background: #fff !important;
            color: #111827 !important;
            color-scheme: light !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          aside, nav, header, [data-sidebar], .no-print {
            display: none !important;
          }
          main, body {
            background: #fff !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .payroll-entries-card {
            border: 0 !important;
            box-shadow: none !important;
          }
          .payroll-entries-card [data-slot="card-header"] {
            padding: 0 0 5mm 0 !important;
          }
          .payroll-entries-card [data-slot="card-content"] {
            padding: 0 !important;
          }
          .payroll-slip-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6mm;
          }
          .payroll-slip {
            border: 1px dashed #64748b;
            border-radius: 0;
            padding: 2mm;
          }
          .payroll-slip-table {
            font-size: 10.5px;
          }
          .payroll-slip-table th,
          .payroll-slip-table td {
            padding: 3.5px 5px;
          }
          .payroll-slip-table .payroll-slip-employee {
            font-size: 17px;
            padding: 8px 5px;
          }
          .payroll-slip-table .payroll-slip-total-head {
            font-size: 13px;
          }
          .payroll-slip-table .payroll-slip-total-head span,
          .payroll-slip-table .amount,
          .payroll-slip-table td:nth-child(2) {
            font-size: 11px;
          }
          .payroll-slip-total td {
            font-size: 12px;
          }
        }
      `}),e.jsxs("div",{className:"no-print grid grid-cols-1 md:grid-cols-4 gap-6 mb-6",children:[e.jsxs(p,{children:[e.jsxs(m,{className:"flex flex-row items-center justify-between space-y-0 pb-2",children:[e.jsx(u,{className:"text-sm font-medium",children:l("Total Employees")}),e.jsx(Y,{className:"h-4 w-4 text-muted-foreground"})]}),e.jsx(x,{children:e.jsx("div",{className:"text-2xl font-bold",children:r.employee_count})})]}),e.jsxs(p,{children:[e.jsxs(m,{className:"flex flex-row items-center justify-between space-y-0 pb-2",children:[e.jsx(u,{className:"text-sm font-medium",children:l("Gross Pay")}),e.jsx(b,{className:"h-4 w-4 text-muted-foreground"})]}),e.jsx(x,{children:e.jsx("div",{className:"text-2xl font-bold text-green-600",children:(v=window.appSettings)==null?void 0:v.formatCurrency(r.total_gross_pay)})})]}),e.jsxs(p,{children:[e.jsxs(m,{className:"flex flex-row items-center justify-between space-y-0 pb-2",children:[e.jsx(u,{className:"text-sm font-medium",children:l("Total Deductions")}),e.jsx(b,{className:"h-4 w-4 text-muted-foreground"})]}),e.jsx(x,{children:e.jsx("div",{className:"text-2xl font-bold text-red-600",children:(k=window.appSettings)==null?void 0:k.formatCurrency(r.total_deductions)})})]}),e.jsxs(p,{children:[e.jsxs(m,{className:"flex flex-row items-center justify-between space-y-0 pb-2",children:[e.jsx(u,{className:"text-sm font-medium",children:l("Net Pay")}),e.jsx(b,{className:"h-4 w-4 text-muted-foreground"})]}),e.jsx(x,{children:e.jsx("div",{className:"text-2xl font-bold text-blue-600",children:(S=window.appSettings)==null?void 0:S.formatCurrency(r.total_net_pay)})})]})]}),e.jsxs(p,{className:"no-print mb-6",children:[e.jsxs(m,{className:"flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",children:[e.jsx(u,{children:l("Payroll Run Details")}),r.status==="completed"&&e.jsxs(K,{type:"button",variant:"outline",size:"sm",onClick:_,children:[e.jsx(C,{className:"mr-2 h-4 w-4"}),l("Download Payroll")]})]}),e.jsxs(x,{children:[e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium text-gray-500",children:l("Pay Period")}),e.jsxs("p",{className:"text-sm",children:[((D=window.appSettings)==null?void 0:D.formatDateTimeSimple(r.pay_period_start,!1))||new Date(r.pay_period_start).toLocaleDateString()," - ",((L=window.appSettings)==null?void 0:L.formatDateTimeSimple(r.pay_period_end,!1))||new Date(r.pay_period_end).toLocaleDateString()]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium text-gray-500",children:l("Pay Date")}),e.jsx("p",{className:"text-sm",children:((P=window.appSettings)==null?void 0:P.formatDateTimeSimple(r.pay_date,!1))||new Date(r.pay_date).toLocaleDateString()})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium text-gray-500",children:l("Payroll Frequency")}),e.jsx("p",{className:"text-sm",children:e.jsx("span",{className:"inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10",children:r.payroll_frequency==="weekly"?l("Weekly"):r.payroll_frequency==="biweekly"?l("Bi-Weekly"):l("Monthly")})})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium text-gray-500",children:l("Status")}),e.jsx("p",{children:e.jsx("span",{className:`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${q(r.status)}`,children:l(r.status)})})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium text-gray-500",children:l("Created At")}),e.jsx("p",{className:"text-sm",children:((M=window.appSettings)==null?void 0:M.formatDateTimeSimple(r.created_at,!1))||new Date(r.created_at).toLocaleDateString()})]})]}),r.notes&&e.jsxs("div",{className:"mt-4",children:[e.jsx("label",{className:"text-sm font-medium text-gray-500",children:l("Notes")}),e.jsx("p",{className:"text-sm mt-1",children:r.notes})]}),j.length>0&&e.jsxs("div",{className:"mt-4",children:[e.jsx("label",{className:"text-sm font-medium text-gray-500",children:l("Holiday Exclusions")}),e.jsx("div",{className:"mt-2 flex flex-wrap gap-2",children:j.map(t=>{var a,o;return e.jsxs("span",{className:"inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20",children:[t.name||l("Holiday")," · ",((o=(a=window.appSettings)==null?void 0:a.formatDateTimeSimple)==null?void 0:o.call(a,t.date,!1))||t.date]},t.date)})})]})]})]}),e.jsxs(p,{className:"payroll-entries-card print:shadow-none",children:[e.jsx(m,{children:e.jsx(u,{children:l("Employee Payroll Entries")})}),e.jsx(x,{children:e.jsx("div",{className:"payroll-slip-grid",children:H.map((t,a)=>{const o=T(t.employee),s=B(t),n=$(t),i=t.unpaid_leave_days||t.absent_days||0,E=w(t),I=Number(t.profile_bonus_amount||0)>0;return e.jsx("div",{className:"payroll-slip",children:e.jsx("table",{className:"payroll-slip-table",children:e.jsxs("tbody",{children:[e.jsxs("tr",{className:"payroll-slip-head",children:[e.jsx("th",{className:"payroll-slip-employee",colSpan:2,children:R(t)}),e.jsxs("th",{className:"payroll-slip-total-head",children:[l("TOTAL"),e.jsx("span",{children:c(t.net_pay)})]})]}),e.jsxs("tr",{className:"payroll-slip-meta",children:[e.jsx("td",{children:l("Employee ID")}),e.jsx("td",{children:o}),e.jsx("td",{children:F(t)})]}),e.jsxs("tr",{children:[e.jsx("td",{children:l("LATE")}),e.jsx("td",{children:A(s)}),e.jsx("td",{className:"amount danger",children:f(n)})]}),e.jsxs("tr",{children:[e.jsx("td",{children:l("ABSENT")}),e.jsxs("td",{children:[z(i)," ",l("days")]}),e.jsx("td",{className:"amount danger",children:f(t.absence_deduction)})]}),e.jsxs("tr",{children:[e.jsx("td",{children:l("FINE")}),e.jsx("td",{children:c(E)}),e.jsx("td",{className:"amount danger",children:f(E)})]}),I&&e.jsxs("tr",{children:[e.jsx("td",{children:l("BONUS")}),e.jsx("td",{children:c(t.bonus_amount)}),e.jsx("td",{className:"amount success",children:c(t.bonus_amount)})]}),e.jsxs("tr",{children:[e.jsx("td",{children:l("Salary")}),e.jsx("td",{children:c(t.basic_salary)}),e.jsx("td",{className:"amount",children:c(t.basic_salary)})]}),e.jsxs("tr",{children:[e.jsx("td",{children:l("Advance")}),e.jsx("td",{children:c(t.advance_deduction)}),e.jsx("td",{className:"amount danger",children:f(t.advance_deduction)})]})]})})},t.id||`${t.employee_id}-${a}`)})})})]})]})}export{Me as default};
